import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { DataSource } from 'typeorm';
import { existsSync } from 'fs';
import { resolve } from 'path';
import { bootstrapTestApp, ensureUser, loginAndGetCookie } from './test-helpers';

describe('Invoice edit-after-send (e2e)', () => {
  let app: INestApplication;
  let cookie: string;
  let customerId: number;
  let invoiceUuid: string;
  let invoiceId: number;
  const YEAR = new Date().getFullYear();

  beforeAll(async () => {
    app = await bootstrapTestApp();
    const ds = app.get(DataSource);
    // Clean state FIRST (before ensureUser, so FKs don't block user deletion)
    await ds.query('DELETE FROM invoice_items');
    await ds.query('DELETE FROM invoice_revisions');
    await ds.query('DELETE FROM email_logs');
    await ds.query('DELETE FROM invoices');
    await ds.query('DELETE FROM invoice_counters WHERE year = ?', [YEAR]);
    await ds.query('DELETE FROM customer_cc_emails');
    await ds.query('DELETE FROM customers');

    await ensureUser(app, 'admin-edit@aquester.com', 'pw1', 'admin');
    cookie = await loginAndGetCookie(app, 'admin-edit@aquester.com', 'pw1');

    const r = await ds.query(`INSERT INTO customers(company_name,address,primary_email) VALUES('Acme','Kathmandu','a@x.com')`);
    customerId = r.insertId;

    const create = await request(app.getHttpServer())
      .post('/invoices/new').set('Cookie', cookie)
      .send({ customerId, invoiceDate: `${YEAR}-09-22`,
        items: [{ itemName: 'X', description: 'd', unitCost: '100', quantity: '1' }],
      }).expect(302);
    invoiceUuid = create.headers.location.split('/').pop() as string;
    expect(invoiceUuid).toMatch(/^[0-9a-f-]{36}$/);

    const [row] = await ds.query('SELECT id FROM invoices WHERE uuid = ?', [invoiceUuid]);
    invoiceId = row.id;

    // Simulate send (real send endpoint ships in Task 4.5)
    await ds.query(`UPDATE invoices SET status='sent', sent_at = NOW() WHERE id = ?`, [invoiceId]);
  }, 60_000);

  afterAll(async () => { await app.close(); });

  it('editing a sent invoice creates a revision row, bumps revision, status=corrected, new PDF on disk', async () => {
    await request(app.getHttpServer())
      .post(`/invoices/${invoiceUuid}/edit`).set('Cookie', cookie)
      .send({ customerId, invoiceDate: `${YEAR}-09-23`,
        items: [{ itemName: 'X-fix', description: 'd', unitCost: '120', quantity: '1' }],
      }).expect(302);

    const ds = app.get(DataSource);
    const [inv] = await ds.query('SELECT status, revision, subtotal FROM invoices WHERE id = ?', [invoiceId]);
    expect(inv.status).toBe('corrected');
    expect(inv.revision).toBe(2);
    expect(inv.subtotal).toBe('120.00');

    const [{ c }] = await ds.query('SELECT count(*) c FROM invoice_revisions WHERE invoice_id = ?', [invoiceId]);
    expect(Number(c)).toBe(1);

    const storageDir = resolve(process.env.PDF_STORAGE_DIR || './storage/invoices');
    const r1 = `${storageDir}/${YEAR}-001-r1.pdf`;
    const r2 = `${storageDir}/${YEAR}-001-r2.pdf`;
    expect(existsSync(r1)).toBe(true);
    expect(existsSync(r2)).toBe(true);
  }, 60_000);
});
