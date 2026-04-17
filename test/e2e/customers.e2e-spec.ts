import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { DataSource } from 'typeorm';
import { bootstrapTestApp, ensureUser, loginAndGetCookie } from './test-helpers';

describe('Customers (e2e)', () => {
  let app: INestApplication;
  let adminCookie: string;
  let viewerCookie: string;

  beforeAll(async () => {
    app = await bootstrapTestApp();
    await ensureUser(app, 'admin-cust@aquester.com', 'pw1', 'admin');
    await ensureUser(app, 'viewer-cust@aquester.com', 'pw1', 'viewer');
    adminCookie = await loginAndGetCookie(app, 'admin-cust@aquester.com', 'pw1');
    viewerCookie = await loginAndGetCookie(app, 'viewer-cust@aquester.com', 'pw1');
    const ds = app.get(DataSource);
    await ds.query('DELETE FROM invoice_items');
    await ds.query('DELETE FROM invoice_revisions');
    await ds.query('DELETE FROM email_logs');
    await ds.query('DELETE FROM invoices');
    await ds.query('DELETE FROM customer_cc_emails');
    await ds.query('DELETE FROM customers');
  });

  afterAll(async () => { await app.close(); });

  it('admin can create + view + edit a customer', async () => {
    await request(app.getHttpServer())
      .post('/customers/new')
      .set('Cookie', adminCookie)
      .send({
        companyName: 'Acme', registrationNumber: '999',
        address: 'Kathmandu', primaryEmail: 'acme@example.com',
        ccEmails: 'a@example.com\nb@example.com',
      })
      .expect(302);

    const list = await request(app.getHttpServer())
      .get('/customers')
      .set('Cookie', adminCookie).expect(200);
    expect(list.text).toContain('Acme');

    const ds = app.get(DataSource);
    const [row] = await ds.query(`SELECT id FROM customers WHERE company_name='Acme'`);
    const detail = await request(app.getHttpServer())
      .get(`/customers/${row.id}`).set('Cookie', adminCookie).expect(200);
    expect(detail.text).toContain('a@example.com');
    expect(detail.text).toContain('b@example.com');

    await request(app.getHttpServer())
      .post(`/customers/${row.id}/edit`).set('Cookie', adminCookie)
      .send({
        companyName: 'Acme Co.', registrationNumber: '999',
        address: 'Kathmandu', primaryEmail: 'acme@example.com',
        ccEmails: 'c@example.com',
      }).expect(302);
    const after = await request(app.getHttpServer())
      .get(`/customers/${row.id}`).set('Cookie', adminCookie).expect(200);
    expect(after.text).toContain('Acme Co.');
    expect(after.text).toContain('c@example.com');
    expect(after.text).not.toContain('a@example.com');
  });

  it('viewer cannot open new-customer page', async () => {
    await request(app.getHttpServer())
      .get('/customers/new').set('Cookie', viewerCookie).expect(403);
  });

  it('viewer cannot post to /customers/new', async () => {
    await request(app.getHttpServer())
      .post('/customers/new').set('Cookie', viewerCookie)
      .send({ companyName: 'x', address: 'y', primaryEmail: 'x@y.com', ccEmails: '' })
      .expect(403);
  });

  it('viewer can view the customer list', async () => {
    const res = await request(app.getHttpServer())
      .get('/customers').set('Cookie', viewerCookie).expect(200);
    expect(res.text).toContain('Customers');
  });

  it('viewer can view a customer detail page', async () => {
    const ds = app.get(DataSource);
    const [row] = await ds.query(`SELECT id FROM customers WHERE company_name='Acme Co.'`);
    const res = await request(app.getHttpServer())
      .get(`/customers/${row.id}`).set('Cookie', viewerCookie).expect(200);
    expect(res.text).toContain('Acme Co.');
  });

  it('viewer cannot open the users page', async () => {
    await request(app.getHttpServer())
      .get('/users').set('Cookie', viewerCookie).expect(403);
  });
});
