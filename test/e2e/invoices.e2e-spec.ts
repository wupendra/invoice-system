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
    expect(newPath).toMatch(/^\/invoices\/[0-9a-f-]{36}$/);
    const uuid = newPath.split('/').pop() as string;

    const pdf = await request(app.getHttpServer())
      .get(`/invoices/${uuid}/pdf`).set('Cookie', adminCookie).expect(200);
    expect(pdf.headers['content-type']).toBe('application/pdf');
    expect(pdf.body.slice(0, 4).toString()).toBe('%PDF');
  }, 60_000);

  it('list filters by customer', async () => {
    const res = await request(app.getHttpServer())
      .get(`/invoices?customerId=${customerId}`).set('Cookie', adminCookie).expect(200);
    expect(res.text).toContain('Acme');
    expect(res.text).toContain(`${YEAR}-001`);
  });

  it('duplicate creates a new invoice with the same items and today date', async () => {
    // First grab an existing invoice uuid (from the earlier test in this file)
    const ds = app.get(DataSource);
    const [src] = await ds.query('SELECT uuid, invoice_number FROM invoices ORDER BY id ASC LIMIT 1');
    const sourceUuid = src.uuid;

    const dup = await request(app.getHttpServer())
      .post(`/invoices/${sourceUuid}/duplicate`).set('Cookie', adminCookie)
      .expect(302);
    const newPath = dup.headers.location;
    expect(newPath).toMatch(/^\/invoices\/[0-9a-f-]{36}$/);
    const newUuid = newPath.split('/').pop();
    expect(newUuid).not.toBe(sourceUuid);

    const [srcRow] = await ds.query('SELECT id FROM invoices WHERE uuid = ?', [sourceUuid]);
    const [dupRow] = await ds.query(
      'SELECT id, invoice_number, customer_id, invoice_date, status, revision FROM invoices WHERE uuid = ?',
      [newUuid],
    );
    expect(dupRow.id).not.toBe(srcRow.id);
    expect(dupRow.status).toBe('draft');
    expect(dupRow.revision).toBe(1);
    // Duplicate's date is today — service stores the UTC date string; MySQL may return it as a
    // Date object (midnight local), so we normalise to the local YYYY-MM-DD for comparison.
    const todayLocal = new Date().toLocaleDateString('sv-SE'); // 'sv-SE' gives YYYY-MM-DD in local tz
    let dupDate: string;
    if (typeof dupRow.invoice_date === 'string') {
      dupDate = dupRow.invoice_date.slice(0, 10);
    } else {
      // Date object returned by MySQL driver — use local date parts to avoid UTC shift
      const d = new Date(dupRow.invoice_date);
      dupDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }
    expect(dupDate).toBe(todayLocal);
    // Items were copied
    const srcItems = await ds.query('SELECT item_name, unit_cost, quantity FROM invoice_items WHERE invoice_id = ? ORDER BY sort_order', [srcRow.id]);
    const dupItems = await ds.query('SELECT item_name, unit_cost, quantity FROM invoice_items WHERE invoice_id = ? ORDER BY sort_order', [dupRow.id]);
    expect(dupItems).toEqual(srcItems);
  }, 60_000);
});
