import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { randomUUID } from 'crypto';
import { Invoice } from '../entities/invoice.entity';
import { InvoiceItem } from '../entities/invoice-item.entity';
import { CountersService } from '../counters/counters.service';
import { SettingsService } from '../settings/settings.service';
import { computeLineTotal, computeTotals } from '../common/helpers/money';
import { amountInWords } from '../common/helpers/amount-in-words';
import { InvoiceDto } from './dto/invoice.dto';
import { ConfigService } from '@nestjs/config';
import { PdfService } from '../pdf/pdf.service';
import { buildPdfModel } from './invoice-mapper';
import { resolve } from 'path';
import * as Hbs from 'hbs';
import { readFile } from 'fs/promises';

@Injectable()
export class InvoicesService {
  constructor(
    @InjectDataSource() private readonly ds: DataSource,
    private readonly counters: CountersService,
    private readonly settings: SettingsService,
    private readonly pdf: PdfService,
    private readonly config: ConfigService,
  ) {}

  async create(dto: InvoiceDto, userId: number): Promise<Invoice> {
    const settings = await this.settings.get();
    const year = new Date(dto.invoiceDate).getUTCFullYear();
    const totals = computeTotals(dto.items, settings.vatRate);
    const wordsDefault = amountInWords(totals.grandTotal, settings.currencyLabel);
    const words = dto.amountInWords?.trim() || wordsDefault;

    return this.ds.transaction(async (tx) => {
      const number = await this.counters.claimNext(year, tx);
      const invRepo = tx.getRepository(Invoice);
      const itemRepo = tx.getRepository(InvoiceItem);

      const invoice = await invRepo.save(invRepo.create({
        uuid: randomUUID(),
        invoiceNumber: number,
        year,
        customerId: dto.customerId,
        invoiceDate: dto.invoiceDate,
        subtotal: totals.subtotal,
        vatRate: settings.vatRate,
        vatAmount: totals.vatAmount,
        grandTotal: totals.grandTotal,
        amountInWords: words,
        status: 'draft',
        revision: 1,
        createdBy: userId,
      }));

      await itemRepo.save(dto.items.map((it, idx) => ({
        invoiceId: invoice.id,
        sortOrder: idx,
        itemName: it.itemName,
        description: it.description,
        unitCost: it.unitCost,
        quantity: it.quantity,
        quantityNote: it.quantityNote,
        lineTotal: computeLineTotal(it.unitCost, it.quantity),
      })));

      return invRepo.findOneOrFail({
        where: { id: invoice.id },
        relations: ['items', 'customer'],
        order: { items: { sortOrder: 'ASC' } } as any,
      });
    });
  }

  async update(id: number, dto: InvoiceDto): Promise<Invoice> {
    const settings = await this.settings.get();
    const totals = computeTotals(dto.items, settings.vatRate);
    const wordsDefault = amountInWords(totals.grandTotal, settings.currencyLabel);
    const words = dto.amountInWords?.trim() || wordsDefault;

    return this.ds.transaction(async (tx) => {
      const invRepo = tx.getRepository(Invoice);
      const itemRepo = tx.getRepository(InvoiceItem);
      const current = await invRepo.findOne({
        where: { id }, relations: ['items', 'customer'],
        order: { items: { sortOrder: 'ASC' } } as any,
      });
      if (!current) throw new NotFoundException(`Invoice ${id} not found`);

      const wasSent = current.status === 'sent' || current.status === 'corrected';

      if (wasSent) {
        // Snapshot the current state into invoice_revisions (preserves what the customer received).
        const fileName = `${current.year}-${String(current.invoiceNumber).padStart(3, '0')}-r${current.revision}.pdf`;
        const pdfPath = `${this.config.get<string>('PDF_STORAGE_DIR') ?? './storage/invoices'}/${fileName}`;
        await tx.query(
          `INSERT INTO invoice_revisions (invoice_id, revision_number, snapshot_json, pdf_path)
           VALUES (?, ?, ?, ?)`,
          [id, current.revision, JSON.stringify({
            invoiceNumber: current.invoiceNumber,
            year: current.year,
            customerId: current.customerId,
            invoiceDate: current.invoiceDate,
            subtotal: current.subtotal,
            vatRate: current.vatRate,
            vatAmount: current.vatAmount,
            grandTotal: current.grandTotal,
            amountInWords: current.amountInWords,
            items: current.items.map((i) => ({
              sortOrder: i.sortOrder,
              itemName: i.itemName,
              description: i.description,
              unitCost: i.unitCost,
              quantity: i.quantity,
              quantityNote: i.quantityNote,
              lineTotal: i.lineTotal,
            })),
          }), pdfPath],
        );
      }

      Object.assign(current, {
        customerId: dto.customerId,
        invoiceDate: dto.invoiceDate,
        subtotal: totals.subtotal,
        vatAmount: totals.vatAmount,
        grandTotal: totals.grandTotal,
        amountInWords: words,
        revision: wasSent ? current.revision + 1 : current.revision,
        status: wasSent ? 'corrected' as const : current.status,
      });
      await invRepo.save(current);

      await itemRepo.delete({ invoiceId: id });
      await itemRepo.save(dto.items.map((it, idx) => ({
        invoiceId: id, sortOrder: idx,
        itemName: it.itemName, description: it.description,
        unitCost: it.unitCost, quantity: it.quantity, quantityNote: it.quantityNote,
        lineTotal: computeLineTotal(it.unitCost, it.quantity),
      })));

      return invRepo.findOneOrFail({
        where: { id }, relations: ['items', 'customer'],
        order: { items: { sortOrder: 'ASC' } } as any,
      });
    });
  }

  async findOne(id: number): Promise<Invoice> {
    const inv = await this.ds.getRepository(Invoice).findOne({
      where: { id },
      relations: ['items', 'customer'],
      order: { items: { sortOrder: 'ASC' } } as any,
    });
    if (!inv) throw new NotFoundException(`Invoice ${id} not found`);
    return inv;
  }

  async findByUuid(uuid: string): Promise<Invoice> {
    const inv = await this.ds.getRepository(Invoice).findOne({
      where: { uuid },
      relations: ['items', 'customer'],
      order: { items: { sortOrder: 'ASC' } } as any,
    });
    if (!inv) throw new NotFoundException(`Invoice ${uuid} not found`);
    return inv;
  }

  async renderPdf(id: number): Promise<{ buffer: Buffer; path: string; fileName: string }> {
    const invoice = await this.findOne(id);
    const settings = await this.settings.get();
    const logoAbs = resolve(settings.logoPath ?? 'public/logo.png');
    let logoSrc = '';
    try {
      const { readFile: readFileAsync } = await import('fs/promises');
      const logoBuf = await readFileAsync(logoAbs);
      // Sniff extension → mime
      const ext = logoAbs.toLowerCase().split('.').pop() ?? 'png';
      const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : ext === 'svg' ? 'image/svg+xml' : 'image/png';
      logoSrc = `data:${mime};base64,${logoBuf.toString('base64')}`;
    } catch {
      // If the logo file is missing or unreadable, fall back to empty src — PDF still renders.
      logoSrc = '';
    }
    const tplPath = resolve('views/invoice-pdf.hbs');
    const tplSrc = await readFile(tplPath, 'utf8');
    const tpl = Hbs.handlebars.compile(tplSrc);
    const html = tpl(buildPdfModel(invoice, settings, logoSrc));
    const buffer = await this.pdf.renderHtmlToBuffer(html);
    const fileName = `${invoice.year}-${String(invoice.invoiceNumber).padStart(3, '0')}-r${invoice.revision}.pdf`;
    const path = await this.pdf.writeBufferToDisk(buffer, fileName);
    return { buffer, path, fileName };
  }

  list(filters: { year?: number; customerId?: number; status?: string }): Promise<Invoice[]> {
    const qb = this.ds.getRepository(Invoice).createQueryBuilder('inv')
      .leftJoinAndSelect('inv.customer', 'customer')
      .orderBy('inv.year', 'DESC').addOrderBy('inv.invoiceNumber', 'DESC');
    if (filters.year) qb.andWhere('inv.year = :year', { year: filters.year });
    if (filters.customerId) qb.andWhere('inv.customerId = :cid', { cid: filters.customerId });
    if (filters.status) qb.andWhere('inv.status = :status', { status: filters.status });
    return qb.getMany();
  }
}
