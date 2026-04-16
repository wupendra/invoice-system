import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import puppeteer, { Browser } from 'puppeteer';
import { bootstrapTestApp, ensureUser, loginAndGetCookie } from './test-helpers';

describe('Invoice form UI (puppeteer)', () => {
  let app: INestApplication;
  let browser: Browser;
  let baseUrl: string;
  let cookieValue: string; // just the aq_token=... portion

  beforeAll(async () => {
    app = await bootstrapTestApp();

    // Seed test admin + a customer so /invoices/new has something in the dropdown
    await ensureUser(app, 'admin-ui@aquester.com', 'pw1', 'admin');
    const ds = app.get(DataSource);
    await ds.query('DELETE FROM invoice_items');
    await ds.query('DELETE FROM invoice_revisions');
    await ds.query('DELETE FROM email_logs');
    await ds.query('DELETE FROM invoices');
    await ds.query('DELETE FROM customer_cc_emails');
    await ds.query('DELETE FROM customers');
    await ds.query(`INSERT INTO customers(company_name,address,primary_email) VALUES('UI Test Co','Kathmandu','ui@x.com')`);

    // Real HTTP server on a random port (puppeteer can't use supertest's in-process server)
    await app.listen(0);
    const port = (app.getHttpServer().address() as any).port;
    baseUrl = `http://127.0.0.1:${port}`;

    // Login via supertest to grab the aq_token cookie value
    const cookieHeader = await loginAndGetCookie(app, 'admin-ui@aquester.com', 'pw1');
    // cookieHeader looks like: "aq_token=eyJ..."
    cookieValue = cookieHeader; // pass through; we split below for puppeteer

    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
  }, 60_000);

  afterAll(async () => {
    if (browser) await browser.close();
    if (app) await app.close();
  });

  it('clicking "+ Add row" adds a second item row', async () => {
    const page = await browser.newPage();
    try {
      // Set the aq_token cookie so the navigation is authenticated
      const [name, value] = cookieValue.split('=');
      await page.setCookie({ name, value, url: baseUrl });

      await page.goto(`${baseUrl}/invoices/new`, { waitUntil: 'networkidle0' });

      // Wait for Alpine to initialize and render at least one row
      await page.waitForFunction(() => (window as any).Alpine, { timeout: 5_000 });
      await page.waitForSelector('table tbody tr', { timeout: 5_000 });

      const initial = await page.$$eval('table tbody tr', (rows) => rows.length);
      expect(initial).toBe(1);

      // Click the standalone "+ Add row" button (the one OUTSIDE the table; matches by visible text)
      await page.evaluate(() => {
        const btn = Array.from(document.querySelectorAll('button')).find(
          (b) => (b.textContent || '').trim().startsWith('+ Add row'),
        );
        if (!btn) throw new Error('Add row button not found in DOM');
        (btn as HTMLButtonElement).click();
      });

      // Alpine renders synchronously on click but give it a microtask tick
      await new Promise((r) => setTimeout(r, 200));

      const after = await page.$$eval('table tbody tr', (rows) => rows.length);
      expect(after).toBe(2);
    } finally {
      await page.close();
    }
  }, 30_000);

  it('typing in unit cost + qty updates the live total in the row', async () => {
    const page = await browser.newPage();
    try {
      const [name, value] = cookieValue.split('=');
      await page.setCookie({ name, value, url: baseUrl });

      await page.goto(`${baseUrl}/invoices/new`, { waitUntil: 'networkidle0' });

      // Wait for Alpine to initialize and render at least one row
      await page.waitForFunction(() => (window as any).Alpine, { timeout: 5_000 });
      // Wait for Alpine to bind :name attributes (x-for renders tr, then x-bind processes :name)
      await page.waitForSelector('input[name="items[0][unitCost]"]', { timeout: 5_000 });

      // Type unit cost = 1600 in the first row
      // Alpine uses x-for + :name binding so the actual DOM input gets name="items[0][unitCost]"
      // after Alpine renders; use attribute selector to target it
      const unitCostInput = await page.$('input[name="items[0][unitCost]"]');
      if (!unitCostInput) throw new Error('unitCost input not found');
      await unitCostInput.click({ clickCount: 3 }); // select all
      await unitCostInput.type('1600');

      // Quantity already pre-fills to 1 — change to 24
      const qtyInput = await page.$('input[name="items[0][quantity]"]');
      if (!qtyInput) throw new Error('quantity input not found');
      await qtyInput.click({ clickCount: 3 });
      await qtyInput.type('24');

      // Tick for Alpine to recompute
      await new Promise((r) => setTimeout(r, 200));

      // The line total cell uses x-text="formatMoney(lineTotal(it))" — read it back.
      // Note: Alpine x-for keeps a <template> as first child of tbody, then inserts <tr> elements
      // after it, so tr:first-child never matches a <tr>. Use tr:first-of-type instead.
      const cellText = await page.$eval('table tbody tr:first-of-type td:nth-child(6)', (el) => el.textContent);
      expect((cellText || '').trim()).toBe('38,400.00');
    } finally {
      await page.close();
    }
  }, 30_000);
});
