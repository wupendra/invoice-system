import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { DataSource } from 'typeorm';
import { bootstrapTestApp, ensureUser, loginAndGetCookie } from './test-helpers';

describe('Invoices (e2e)', () => {
  let app: INestApplication;
  let adminCookie: string;
  let customerId: number;
  const YEAR = new Date().getFullYear();

  beforeAll(async () => {
    app = await bootstrapTestApp();
    const ds = app.get(DataSource);
    await ds.query('DELETE FROM invoice_items');
    await ds.query('DELETE FROM invoice_revisions');
    await ds.query('DELETE FROM email_logs');
    await ds.query('DELETE FROM invoices');
    await ds.query('DELETE FROM invoice_counters WHERE year = ?', [YEAR]);
    await ds.query('DELETE FROM customer_cc_emails');
    await ds.query('DELETE FROM customers');
    await ensureUser(app, 'admin-inv@aquester.com', 'pw1', 'admin');
    adminCookie = await loginAndGetCookie(app, 'admin-inv@aquester.com', 'pw1');
    const ins = await ds.query(`INSERT INTO customers(company_name,address,primary_email) VALUES('Acme','Kathmandu','a@x.com')`);
    customerId = ins.insertId;
  });

  afterAll(async () => { await app.close(); });

  it('admin creates an invoice and the PDF endpoint returns a PDF', async () => {
    const create = await request(app.getHttpServer())
      .post('/invoices/new').set('Cookie', adminCookie)
      .send({
        customerId,
        invoiceDate: `${YEAR}-09-22`,
        items: [
          { itemName: 'Company Emails', description: '...', unitCost: '1600.00', quantity: '24', quantityNote: '8 X 3 (months)' },
          { itemName: 'Email Hosting',  description: '...', unitCost: '1000.00', quantity: '3',  quantityNote: '1 X 3 (months)' },
        ],
      })
      .expect(302);
    const newPath = create.headers.location;
    expect(newPath).toMatch(/^\/invoices\/\d+$/);
    const id = Number(newPath.split('/').pop());

    const pdf = await request(app.getHttpServer())
      .get(`/invoices/${id}/pdf`).set('Cookie', adminCookie).expect(200);
    expect(pdf.headers['content-type']).toBe('application/pdf');
    expect(pdf.body.slice(0, 4).toString()).toBe('%PDF');
  }, 60_000);

  it('list filters by customer', async () => {
    const res = await request(app.getHttpServer())
      .get(`/invoices?customerId=${customerId}`).set('Cookie', adminCookie).expect(200);
    expect(res.text).toContain('Acme');
    expect(res.text).toContain(`${YEAR}-001`);
  });
});
