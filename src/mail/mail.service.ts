import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { Invoice } from '../entities/invoice.entity';

@Injectable()
export class MailService {
  private readonly log = new Logger(MailService.name);
  private transporter?: nodemailer.Transporter;

  constructor(private readonly config: ConfigService) {}

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

  buildSubject(invoice: Pick<Invoice, 'invoiceNumber' | 'status'>): string {
    const num = String(invoice.invoiceNumber).padStart(3, '0');
    const prefix = invoice.status === 'corrected' ? 'Corrected invoice' : 'Invoice';
    return `${prefix} #${num} from Aquester Solutions Pvt. Ltd.`;
  }

  buildBody(invoice: Pick<Invoice, 'invoiceNumber' | 'status' | 'grandTotal'>): string {
    const num = String(invoice.invoiceNumber).padStart(3, '0');
    const total = Number(invoice.grandTotal).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const correction = invoice.status === 'corrected'
      ? `<p><em>We found an error on the previous invoice. Please find the corrected version attached and discard the earlier copy.</em></p>`
      : '';
    return `
      <p>Dear customer,</p>
      ${correction}
      <p>Please find attached invoice <strong>#${num}</strong> for a total of <strong>${total}</strong>.</p>
      <p>Thank you for your business.</p>
      <p>—<br/>Aquester Solutions Pvt. Ltd.</p>
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
