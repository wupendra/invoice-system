import { MailService } from './mail.service';

describe('MailService', () => {
  it('builds the default subject for a normal invoice', () => {
    const svc = new MailService({ get: () => 'irrelevant' } as any);
    expect(svc.buildSubject({ invoiceNumber: 7, status: 'draft' } as any))
      .toBe('Invoice #007 from Aquester Solutions Pvt. Ltd.');
  });

  it('builds the default subject for a corrected invoice', () => {
    const svc = new MailService({ get: () => 'irrelevant' } as any);
    expect(svc.buildSubject({ invoiceNumber: 7, status: 'corrected' } as any))
      .toBe('Corrected invoice #007 from Aquester Solutions Pvt. Ltd.');
  });

  it('builds a body that mentions the invoice number and total', () => {
    const svc = new MailService({ get: () => 'irrelevant' } as any);
    const body = svc.buildBody({ invoiceNumber: 7, status: 'sent', grandTotal: '1234.56' } as any);
    expect(body).toContain('#007');
    expect(body).toContain('1,234.56');
    expect(body).toContain('attached');
  });

  it('appends a correction notice for corrected invoices', () => {
    const svc = new MailService({ get: () => 'x' } as any);
    const body = svc.buildBody({ invoiceNumber: 7, status: 'corrected', grandTotal: '1.00' } as any);
    expect(body).toContain('previous invoice');
    expect(body).toContain('discard');
  });
});
