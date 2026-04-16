import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Invoice } from '../entities/invoice.entity';
import { InvoiceItem } from '../entities/invoice-item.entity';
import { CountersService } from '../counters/counters.service';
import { SettingsService } from '../settings/settings.service';
import { computeLineTotal, computeTotals } from '../common/helpers/money';
import { amountInWords } from '../common/helpers/amount-in-words';
import { InvoiceDto } from './dto/invoice.dto';

@Injectable()
export class InvoicesService {
  constructor(
    @InjectDataSource() private readonly ds: DataSource,
    private readonly counters: CountersService,
    private readonly settings: SettingsService,
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

  async findOne(id: number): Promise<Invoice> {
    const inv = await this.ds.getRepository(Invoice).findOne({
      where: { id },
      relations: ['items', 'customer'],
      order: { items: { sortOrder: 'ASC' } } as any,
    });
    if (!inv) throw new NotFoundException(`Invoice ${id} not found`);
    return inv;
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
