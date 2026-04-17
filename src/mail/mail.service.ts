import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { Invoice } from '../entities/invoice.entity';
import { SettingsService } from '../settings/settings.service';

@Injectable()
export class MailService {
  private readonly log = new Logger(MailService.name);
  private transporter?: nodemailer.Transporter;

  constructor(
    private readonly config: ConfigService,
    private readonly settings: SettingsService,
  ) {}

  private getTransporter(): nodemailer.Transporter {
    if (!this.transporter) {
      this.transporter = nodemailer.createTransport({
        host: this.config.get<string>('SMTP_HOST'),
        port: Number(this.config.get<string>('SMTP_PORT')),
        secure: Number(this.config.get<string>('SMTP_PORT')) === 465,
        auth: {
          user: this.config.get<string>('SMTP_USER'),
          pass: this.config.get<string>('SMTP_PASS'),
        },
      });
    }
    return this.transporter;
  }

  async buildSubject(invoice: Pick<Invoice, 'invoiceNumber' | 'status'>): Promise<string> {
    const num = String(invoice.invoiceNumber).padStart(3, '0');
    const prefix = invoice.status === 'corrected' ? 'Corrected invoice' : 'Invoice';
    const { fromCompanyName } = await this.settings.get();
    return `${prefix} #${num} from ${fromCompanyName}`;
  }

  async buildBody(invoice: Pick<Invoice, 'invoiceNumber' | 'status' | 'grandTotal'>): Promise<string> {
    const num = String(invoice.invoiceNumber).padStart(3, '0');
    const total = Number(invoice.grandTotal).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const correction = invoice.status === 'corrected'
      ? `<p><em>We found an error on the previous invoice. Please find the corrected version attached and discard the earlier copy.</em></p>`
      : '';
    const { fromCompanyName } = await this.settings.get();
    return `
      <p>Dear customer,</p>
      ${correction}
      <p>Please find attached invoice <strong>#${num}</strong> for a total of <strong>${total}</strong>.</p>
      <p>Thank you for your business.</p>
      <p>—<br/>${fromCompanyName}</p>
    `.trim();
  }

  async send(opts: {
    to: string; cc: string[]; subject: string; html: string;
    attachment: { filename: string; content: Buffer };
  }): Promise<void> {
    const tx = this.getTransporter();
    await tx.sendMail({
      from: this.config.get<string>('SMTP_FROM'),
      to: opts.to,
      cc: opts.cc.length ? opts.cc : undefined,
      subject: opts.subject,
      html: opts.html,
      attachments: [{ filename: opts.attachment.filename, content: opts.attachment.content }],
    });
  }
}
