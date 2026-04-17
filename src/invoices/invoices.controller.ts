import {
  BadRequestException, Body, Controller, Get, Param, ParseIntPipe, Post, Query, Render, Res,
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
    // Pre-generate PDF so download is instant. Don't fail the create if PDF render errors —
    // the user can retry by clicking Download on the view page.
    try { await this.svc.renderPdf(inv.id); } catch (e) { console.error('PDF pre-gen failed:', e); }
    return res.redirect(`/invoices/${inv.id}`);
  }

  @Roles('admin') @Get(':id/edit') @Render('pages/invoices/form')
  async editForm(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthUser) {
    const invoice = await this.svc.findOne(id);
    if (invoice.status !== 'draft') {
      // Phase 4 will handle sent/corrected edit via revision. For now reject with 400.
      throw new BadRequestException('Only draft invoices can be edited right now');
    }
    const customers = await this.customers.list();
    const appSettings = await this.settings.get();
    return {
      title: `Edit invoice ${String(invoice.invoiceNumber).padStart(3, '0')}`,
      layout: 'layouts/main', user, isAdmin: true,
      action: `/invoices/${id}/edit`, mode: 'edit',
      customers, appSettings,
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

  @Roles('admin') @Post(':id/edit')
  async editSubmit(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: InvoiceDto,
    @Res() res: Response,
  ) {
    await this.svc.updateDraft(id, dto);
    try { await this.svc.renderPdf(id); } catch (e) { console.error('PDF regen failed:', e); }
    return res.redirect(`/invoices/${id}`);
  }

  @Get(':id') @Render('pages/invoices/view')
  async view(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthUser) {
    const invoice = await this.svc.findOne(id);
    const appSettings = await this.settings.get();
    const logoSrc = `/public/logo.png`;
    const model = buildPdfModel(invoice, appSettings, logoSrc);
    return {
      title: `Invoice ${model.invoiceNumberPadded}`, layout: 'layouts/main', user,
      isAdmin: user.role === 'admin', invoice, model,
    };
  }

  @Get(':id/pdf')
  async pdf(@Param('id', ParseIntPipe) id: number, @Res() res: Response) {
    const { buffer, fileName } = await this.svc.renderPdf(id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${fileName}"`);
    return res.end(buffer);
  }
}
