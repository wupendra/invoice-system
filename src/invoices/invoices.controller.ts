import {
  Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, Render, Res,
} from '@nestjs/common';
import { Response } from 'express';
import { InvoicesService } from './invoices.service';
import { InvoiceDto } from './dto/invoice.dto';
import { CustomersService } from '../customers/customers.service';
import { SettingsService } from '../settings/settings.service';
import { CountersService } from '../counters/counters.service';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { buildPdfModel } from './invoice-mapper';

@Controller('invoices')
export class InvoicesController {
  constructor(
    private readonly svc: InvoicesService,
    private readonly customers: CustomersService,
    private readonly settings: SettingsService,
    private readonly counters: CountersService,
  ) {}

  @Get() @Render('pages/invoices/list')
  async list(
    @CurrentUser() user: AuthUser,
    @Query('year') year?: string,
    @Query('customerId') customerId?: string,
    @Query('status') status?: string,
  ) {
    const yearNum = year ? Number(year) : undefined;
    const cidNum = customerId ? Number(customerId) : undefined;
    const invoices = await this.svc.list({ year: yearNum, customerId: cidNum, status });
    const customers = await this.customers.list();
    return {
      title: 'Invoices', layout: 'layouts/main', user, isAdmin: user.role === 'admin',
      invoices, customers, year: yearNum ?? '', customerId: cidNum ?? '', status: status ?? '',
    };
  }

  @Roles('admin') @Get('new') @Render('pages/invoices/form')
  async newForm(@CurrentUser() user: AuthUser, @Query('customerId') customerIdRaw?: string) {
    const customers = await this.customers.list();
    const appSettings = await this.settings.get();
    const year = new Date().getFullYear();
    const lastNumber = await this.counters.getCurrent(year);
    const today = new Date().toISOString().slice(0, 10);
    const customerId = customerIdRaw ? Number(customerIdRaw) : (customers[0]?.id ?? 0);
    return {
      title: 'New invoice', layout: 'layouts/main', user, isAdmin: true,
      action: '/invoices/new', mode: 'create',
      customers, appSettings,
      defaults: {
        customerId, invoiceDate: today,
        nextNumber: String(lastNumber + 1).padStart(3, '0'),
        items: [{ itemName: '', description: '', unitCost: '', quantity: '1', quantityNote: '' }],
        amountInWords: '',
      },
    };
  }

  @Roles('admin') @Post('new')
  async createSubmit(@Body() dto: InvoiceDto, @CurrentUser() user: AuthUser, @Res() res: Response) {
    const inv = await this.svc.create(dto, user.id);
    try { await this.svc.renderPdf(inv.id); } catch (e) { console.error('PDF pre-gen failed:', e); }
    return res.redirect(`/invoices/${inv.uuid}`);
  }

  @Roles('admin') @Get(':uuid/edit') @Render('pages/invoices/form')
  async editForm(@Param('uuid', ParseUUIDPipe) uuid: string, @CurrentUser() user: AuthUser) {
    const invoice = await this.svc.findByUuid(uuid);
    // (removed draft-only guard)
    const customers = await this.customers.list();
    const appSettings = await this.settings.get();
    return {
      title: `Edit invoice ${String(invoice.invoiceNumber).padStart(3, '0')}`,
      layout: 'layouts/main', user, isAdmin: true,
      action: `/invoices/${uuid}/edit`, mode: 'edit',
      customers, appSettings,
      isCorrection: invoice.status !== 'draft',   // <- new: flag for the form view
      defaults: {
        customerId: invoice.customerId,
        invoiceDate: typeof invoice.invoiceDate === 'string'
          ? invoice.invoiceDate
          : new Date(invoice.invoiceDate as unknown as Date).toISOString().slice(0, 10),
        nextNumber: String(invoice.invoiceNumber).padStart(3, '0'),
        items: invoice.items.map((it) => ({
          itemName: it.itemName, description: it.description,
          unitCost: it.unitCost, quantity: it.quantity, quantityNote: it.quantityNote ?? '',
        })),
        amountInWords: invoice.amountInWords,
      },
    };
  }

  @Roles('admin') @Post(':uuid/edit')
  async editSubmit(
    @Param('uuid', ParseUUIDPipe) uuid: string,
    @Body() dto: InvoiceDto,
    @Res() res: Response,
  ) {
    const invoice = await this.svc.findByUuid(uuid);
    await this.svc.update(invoice.id, dto);
    try { await this.svc.renderPdf(invoice.id); } catch (e) { console.error('PDF regen failed:', e); }
    return res.redirect(`/invoices/${uuid}`);
  }

  @Roles('admin') @Post(':uuid/duplicate')
  async duplicateInvoice(
    @Param('uuid', ParseUUIDPipe) uuid: string,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ) {
    const inv = await this.svc.duplicate(uuid, user.id);
    try { await this.svc.renderPdf(inv.id); } catch (e) { console.error('PDF pre-gen failed:', e); }
    return res.redirect(`/invoices/${inv.uuid}`);
  }

  @Get(':uuid') @Render('pages/invoices/view')
  async view(@Param('uuid', ParseUUIDPipe) uuid: string, @CurrentUser() user: AuthUser) {
    const invoice = await this.svc.findByUuid(uuid);
    const appSettings = await this.settings.get();
    const logoSrc = `/public/logo.png`;
    const model = buildPdfModel(invoice, appSettings, logoSrc);
    return {
      title: `Invoice ${model.invoiceNumberPadded}`, layout: 'layouts/main', user,
      isAdmin: user.role === 'admin', invoice, model,
    };
  }

  @Get(':uuid/pdf')
  async pdf(@Param('uuid', ParseUUIDPipe) uuid: string, @Res() res: Response) {
    const invoice = await this.svc.findByUuid(uuid);
    const { buffer, downloadFileName } = await this.svc.renderPdf(invoice.id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${downloadFileName}"`);
    return res.end(buffer);
  }
}
