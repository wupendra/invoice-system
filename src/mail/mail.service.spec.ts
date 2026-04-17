import { MailService } from './mail.service';

describe('MailService', () => {
  const config = { get: () => 'irrelevant' } as any;
  const settings = { get: async () => ({ fromCompanyName: 'Aquester Solutions Pvt. Ltd.' }) } as any;

  it('builds the default subject for a normal invoice', async () => {
    const svc = new MailService(config, settings);
    expect(await svc.buildSubject({ invoiceNumber: 7, status: 'draft' } as any))
      .toBe('Invoice #007 from Aquester Solutions Pvt. Ltd.');
  });

  it('builds the default subject for a corrected invoice', async () => {
    const svc = new MailService(config, settings);
    expect(await svc.buildSubject({ invoiceNumber: 7, status: 'corrected' } as any))
      .toBe('Corrected invoice #007 from Aquester Solutions Pvt. Ltd.');
  });

  it('builds a body that mentions the invoice number and total', async () => {
    const svc = new MailService(config, settings);
    const body = await svc.buildBody({ invoiceNumber: 7, status: 'sent', grandTotal: '1234.56' } as any);
    expect(body).toContain('#007');
    expect(body).toContain('1,234.56');
    expect(body).toContain('attached');
  });

  it('appends a correction notice for corrected invoices', async () => {
    const svc = new MailService(config, settings);
    const body = await svc.buildBody({ invoiceNumber: 7, status: 'corrected', grandTotal: '1.00' } as any);
    expect(body).toContain('previous invoice');
    expect(body).toContain('discard');
  });
});
