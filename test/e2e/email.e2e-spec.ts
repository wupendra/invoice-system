import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { DataSource } from 'typeorm';
import { join } from 'path';
import * as cookieParser from 'cookie-parser';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from '../../src/app.module';
import { MailService } from '../../src/mail/mail.service';
import { ensureUser, loginAndGetCookie } from './test-helpers';

describe('Email (e2e, mocked SMTP)', () => {
  let app: NestExpressApplication;
  let cookie: string;
  let customerId: number;
  let invoiceUuid: string;
  let invoiceId: number;
  const sent: any[] = [];
  const YEAR = new Date().getFullYear();

  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(MailService)
      .useValue({
        buildSubject: async (inv: any) => `Invoice #${String(inv.invoiceNumber).padStart(3,'0')} from Aquester Solutions Pvt. Ltd.`,
        buildBody: async (inv: any) => `<p>#${String(inv.invoiceNumber).padStart(3,'0')}</p>`,
        send: async (opts: any) => { sent.push(opts); },
      })
      .compile();

    app = mod.createNestApplication<NestExpressApplication>();
    app.useStaticAssets(join(__dirname, '..', '..', 'public'), { prefix: '/public/' });
    app.setBaseViewsDir(join(__dirname, '..', '..', 'views'));
    app.setViewEngine('hbs');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const hbs = require('hbs');
    hbs.registerPartials(join(__dirname, '..', '..', 'views', 'partials'));
    hbs.registerHelper('numFmt', (v: any) => Number(v).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
    hbs.registerHelper('nl2br', (s: string) => (s ?? '').toString().replace(/\n/g, '<br>'));
    hbs.registerHelper('json', (v: unknown) => JSON.stringify(v ?? null));
    hbs.registerHelper('eq', (a: unknown, b: unknown) => String(a) === String(b));
    hbs.registerHelper('padNum', (n: number) => String(n).padStart(3, '0'));
    app.use(cookieParser());
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
    await app.init();

    const ds = app.get(DataSource);
    // Clean FIRST
    await ds.query('DELETE FROM invoice_items');
    await ds.query('DELETE FROM invoice_revisions');
    await ds.query('DELETE FROM email_logs');
    await ds.query('DELETE FROM invoices');
    await ds.query('DELETE FROM invoice_counters WHERE year = ?', [YEAR]);
    await ds.query('DELETE FROM customer_cc_emails');
    await ds.query('DELETE FROM customers');

    await ensureUser(app, 'admin-mail@aquester.com', 'pw1', 'admin');
    cookie = await loginAndGetCookie(app, 'admin-mail@aquester.com', 'pw1');

    const r = await ds.query(`INSERT INTO customers(company_name,address,primary_email) VALUES('Acme','Kathmandu','to@example.com')`);
    customerId = r.insertId;

    const create = await request(app.getHttpServer())
      .post('/invoices/new').set('Cookie', cookie)
      .send({ customerId, invoiceDate: `${YEAR}-09-22`,
        items: [{ itemName: 'X', description: 'd', unitCost: '100', quantity: '1' }],
      }).expect(302);
    invoiceUuid = create.headers.location.split('/').pop() as string;
    const [row] = await ds.query('SELECT id FROM invoices WHERE uuid = ?', [invoiceUuid]);
    invoiceId = row.id;
  }, 60_000);

  afterAll(async () => { await app.close(); });

  it('send writes an email_log row, flips status to sent, calls transport with attachment', async () => {
    await request(app.getHttpServer())
      .post(`/invoices/${invoiceUuid}/email`).set('Cookie', cookie)
      .send({
        subject: `Invoice #001 from Aquester Solutions Pvt. Ltd.`,
        bodyHtml: '<p>hi</p>',
        ccEmails: 'cc1@example.com,cc2@example.com',
      }).expect(302);

    expect(sent.length).toBe(1);
    expect(sent[0].to).toBe('to@example.com');
    expect(sent[0].cc).toEqual(['cc1@example.com', 'cc2@example.com']);
    expect(sent[0].attachment.filename).toMatch(/-r1\.pdf$/);
    expect(sent[0].attachment.content.slice(0,4).toString()).toBe('%PDF');

    const ds = app.get(DataSource);
    const [inv] = await ds.query('SELECT status, sent_at FROM invoices WHERE id = ?', [invoiceId]);
    expect(inv.status).toBe('sent');
    expect(inv.sent_at).not.toBeNull();
    const [{ c }] = await ds.query('SELECT count(*) c FROM email_logs WHERE invoice_id = ?', [invoiceId]);
    expect(Number(c)).toBe(1);
  }, 60_000);
});
