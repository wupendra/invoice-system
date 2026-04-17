import { Test } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { InvoicesModule } from './invoices.module';
import { InvoicesService } from './invoices.service';
import { CustomersModule } from '../customers/customers.module';
import { CustomersService } from '../customers/customers.service';
import { SettingsModule } from '../settings/settings.module';
import { CountersModule } from '../counters/counters.module';
import { buildTypeOrmOptions } from '../config/typeorm.options';
import { validateEnv } from '../config/env.validation';

describe('InvoicesService.create (integration)', () => {
  let svc: InvoicesService; let customers: CustomersService; let ds: DataSource;
  let userId: number; let customerId: number;
  const YEAR = new Date().getFullYear();

  beforeAll(async () => {
    const mod = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
        TypeOrmModule.forRootAsync({
          inject: [ConfigService],
          useFactory: (config: ConfigService) => buildTypeOrmOptions(config),
        }),
        SettingsModule, CountersModule, CustomersModule, InvoicesModule,
      ],
    }).compile();
    svc = mod.get(InvoicesService);
    customers = mod.get(CustomersService);
    ds = mod.get(DataSource);

    await ds.query('DELETE FROM invoice_items');
    await ds.query('DELETE FROM invoice_revisions');
    await ds.query('DELETE FROM email_logs');
    await ds.query('DELETE FROM invoices');
    await ds.query('DELETE FROM invoice_counters WHERE year = ?', [YEAR]);

    await ds.query("DELETE FROM users WHERE email='svc-test@aquester.com'");
    const r = await ds.query(`INSERT INTO users(email,password_hash,role) VALUES('svc-test@aquester.com','x','admin')`);
    userId = r.insertId;

    const c = await customers.create({
      companyName: 'Acme', address: 'addr', primaryEmail: 'a@x.com',
      ccEmails: [], registrationNumber: undefined, phone: undefined, notes: undefined,
    });
    customerId = c.id;
  });

  afterAll(async () => { await ds.destroy(); });

  it('creates an invoice with claimed number 1, computes totals, status=draft', async () => {
    const inv = await svc.create({
      customerId,
      invoiceDate: `${YEAR}-09-22`,
      items: [
        { itemName: 'Company Emails', description: '...', unitCost: '1600.00', quantity: '24', quantityNote: '8 X 3 (months)' },
        { itemName: 'Email Hosting',  description: '...', unitCost: '1000.00', quantity: '3',  quantityNote: '1 X 3 (months)' },
      ],
    }, userId);
    expect(inv.invoiceNumber).toBe(1);
    expect(inv.year).toBe(YEAR);
    expect(inv.subtotal).toBe('41400.00');
    expect(inv.vatAmount).toBe('5382.00');
    expect(inv.grandTotal).toBe('46782.00');
    expect(inv.status).toBe('draft');
    expect(inv.revision).toBe(1);
    expect(inv.amountInWords.startsWith('Forty-six thousand seven hundred eighty-two')).toBe(true);
    expect(inv.items.length).toBe(2);
    expect(inv.items[0].lineTotal).toBe('38400.00');
  });

  it('next invoice claims number 2', async () => {
    const inv = await svc.create({
      customerId, invoiceDate: `${YEAR}-09-23`,
      items: [{ itemName: 'X', description: 'y', unitCost: '100', quantity: '1' }],
    }, userId);
    expect(inv.invoiceNumber).toBe(2);
  });

  it('edit after send creates a revision row, bumps revision, sets status=corrected', async () => {
    const inv = await svc.create({
      customerId, invoiceDate: `${YEAR}-09-22`,
      items: [{ itemName: 'A', description: 'd', unitCost: '100', quantity: '1' }],
    }, userId);

    // simulate a send: flip status manually (real send ships in Task 4.5)
    await ds.query(`UPDATE invoices SET status='sent', sent_at = NOW() WHERE id = ?`, [inv.id]);

    const updated = await svc.update(inv.id, {
      customerId, invoiceDate: `${YEAR}-09-23`,
      items: [{ itemName: 'A-fixed', description: 'd', unitCost: '120', quantity: '1' }],
    });

    expect(updated.status).toBe('corrected');
    expect(updated.revision).toBe(2);
    expect(updated.subtotal).toBe('120.00');

    const [row] = await ds.query('SELECT count(*) c FROM invoice_revisions WHERE invoice_id = ?', [inv.id]);
    expect(Number(row.c)).toBe(1);

    const [snapRow] = await ds.query(
      'SELECT revision_number, snapshot_json FROM invoice_revisions WHERE invoice_id = ?', [inv.id],
    );
    expect(snapRow.revision_number).toBe(1);
    const snap = typeof snapRow.snapshot_json === 'string' ? JSON.parse(snapRow.snapshot_json) : snapRow.snapshot_json;
    expect(snap.items[0].itemName).toBe('A');
    expect(snap.subtotal).toBe('100.00');
  });

  it('duplicate copies items and customer, claims next number, uses today', async () => {
    const original = await svc.create({
      customerId,
      invoiceDate: `${YEAR}-09-22`,
      items: [
        { itemName: 'Original item', description: 'desc', unitCost: '500.00', quantity: '2', quantityNote: '2 months' },
      ],
    }, userId);

    const copy = await svc.duplicate(original.uuid, userId);

    expect(copy.id).not.toBe(original.id);
    expect(copy.uuid).not.toBe(original.uuid);
    expect(copy.invoiceNumber).toBe(original.invoiceNumber + 1);
    expect(copy.customerId).toBe(original.customerId);
    expect(copy.status).toBe('draft');
    expect(copy.revision).toBe(1);
    expect(copy.sentAt).toBeFalsy();
    expect(copy.items.length).toBe(1);
    expect(copy.items[0].itemName).toBe('Original item');
    expect(copy.items[0].description).toBe('desc');
    expect(copy.items[0].unitCost).toBe('500.00');
    expect(copy.items[0].quantity).toBe('2.00');
    expect(copy.items[0].quantityNote).toBe('2 months');
    expect(copy.items[0].lineTotal).toBe('1000.00');

    // Date is today (YYYY-MM-DD local)
    const today = new Date().toLocaleDateString('sv-SE');
    expect(copy.invoiceDate).toBe(today);
  });
});
