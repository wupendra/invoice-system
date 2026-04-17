import {
  Body, Controller, Get, Param, ParseUUIDPipe, Post, Render, Res,
} from '@nestjs/common';
import { Response } from 'express';
import { DataSource } from 'typeorm';
import { InjectDataSource } from '@nestjs/typeorm';
import { MailService } from './mail.service';
import { SendEmailDto } from './dto/send-email.dto';
import { InvoicesService } from '../invoices/invoices.service';
import { CustomersService } from '../customers/customers.service';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';

@Controller('invoices/:uuid/email')
@Roles('admin')
export class MailController {
  constructor(
    private readonly mail: MailService,
    private readonly invoices: InvoicesService,
    private readonly customers: CustomersService,
    @InjectDataSource() private readonly ds: DataSource,
  ) {}

  @Get() @Render('pages/invoices/email')
  async preview(
    @Param('uuid', ParseUUIDPipe) uuid: string,
    @CurrentUser() user: AuthUser,
  ) {
    const invoice = await this.invoices.findByUuid(uuid);
    const customer = await this.customers.findOne(invoice.customerId);
    return {
      title: 'Email invoice', layout: 'layouts/main', user, isAdmin: true,
      invoice,
      to: customer.primaryEmail,
      ccText: customer.ccEmails.map((e) => e.email).join('\n'),
      subject: this.mail.buildSubject(invoice),
      bodyHtml: this.mail.buildBody(invoice),
    };
  }

  @Post()
  async send(
    @Param('uuid', ParseUUIDPipe) uuid: string,
    @Body() dto: SendEmailDto,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ) {
    const invoice = await this.invoices.findByUuid(uuid);
    const customer = await this.customers.findOne(invoice.customerId);

    let buffer: Buffer; let fileName: string;
    try {
      const r = await this.invoices.renderPdf(invoice.id);
      buffer = r.buffer; fileName = r.fileName;
    } catch (e: any) {
      return res.render('pages/invoices/email', {
        title: 'Email invoice', layout: 'layouts/main', user, isAdmin: true,
        invoice, to: customer.primaryEmail, ccText: dto.ccEmails.join('\n'),
        subject: dto.subject, bodyHtml: dto.bodyHtml,
        error: `PDF generation failed: ${e?.message || e}`,
      });
    }

    try {
      await this.mail.send({
        to: customer.primaryEmail,
        cc: dto.ccEmails,
        subject: dto.subject,
        html: dto.bodyHtml,
        attachment: { filename: fileName, content: buffer },
      });
    } catch (e: any) {
      return res.render('pages/invoices/email', {
        title: 'Email invoice', layout: 'layouts/main', user, isAdmin: true,
        invoice, to: customer.primaryEmail, ccText: dto.ccEmails.join('\n'),
        subject: dto.subject, bodyHtml: dto.bodyHtml,
        error: `SMTP error: ${e?.message || e}`,
      });
    }

    // Log + flip status
    await this.ds.transaction(async (tx) => {
      await tx.query(
        `INSERT INTO email_logs (invoice_id, to_email, cc_emails_json, subject, body_html, sent_by)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [invoice.id, customer.primaryEmail, JSON.stringify(dto.ccEmails), dto.subject, dto.bodyHtml, user.id],
      );
      // Status flip only on first send — subsequent resends just append to email_logs
      if (invoice.status === 'draft') {
        await tx.query(`UPDATE invoices SET status = 'sent', sent_at = NOW() WHERE id = ?`, [invoice.id]);
      }
    });

    return res.redirect(`/invoices/${uuid}`);
  }
}
