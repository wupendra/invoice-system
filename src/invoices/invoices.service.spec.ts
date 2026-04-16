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
});
