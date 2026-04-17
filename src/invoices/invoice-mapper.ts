import { Invoice } from '../entities/invoice.entity';
import { Settings } from '../entities/settings.entity';
import { formatInvoiceDate } from '../common/helpers/date-format';

export function buildPdfModel(invoice: Invoice, settings: Settings, logoSrc: string) {
  return {
    invoiceNumberPadded: String(invoice.invoiceNumber).padStart(3, '0'),
    invoiceDateFormatted: formatInvoiceDate(invoice.invoiceDate),
    isCorrection: invoice.status === 'corrected',
    items: invoice.items,
    subtotal: invoice.subtotal,
    vatRateFmt: Number(invoice.vatRate).toFixed(2).replace(/\.00$/, ''),
    vatAmount: invoice.vatAmount,
    grandTotal: invoice.grandTotal,
    amountInWords: invoice.amountInWords,
    customer: invoice.customer,
    settings,
    logoSrc,
  };
}
