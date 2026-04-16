import { Test } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { CustomersModule } from './customers.module';
import { CustomersService } from './customers.service';
import { buildTypeOrmOptions } from '../config/typeorm.options';
import { validateEnv } from '../config/env.validation';

describe('CustomersService (integration)', () => {
  let svc: CustomersService;
  let ds: DataSource;

  beforeAll(async () => {
    const mod = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
        TypeOrmModule.forRootAsync({
          inject: [ConfigService],
          useFactory: (config: ConfigService) => buildTypeOrmOptions(config),
        }),
        CustomersModule,
      ],
    }).compile();
    svc = mod.get(CustomersService);
    ds = mod.get(DataSource);
    await ds.query('DELETE FROM invoice_items');
    await ds.query('DELETE FROM invoice_revisions');
    await ds.query('DELETE FROM email_logs');
    await ds.query('DELETE FROM invoices');
    await ds.query('DELETE FROM customer_cc_emails');
    await ds.query('DELETE FROM customers');
  });

  afterAll(async () => { await ds.destroy(); });

  it('creates a customer with CC emails', async () => {
    const c = await svc.create({
      companyName: 'Kaju Art Rugs Pvt. Ltd.',
      registrationNumber: '111',
      address: 'Bauddha, Kathmandu, Nepal',
      primaryEmail: 'rugs@example.com',
      phone: '9800000000',
      notes: '',
      ccEmails: ['ops@example.com', 'finance@example.com'],
    });
    expect(c.id).toBeGreaterThan(0);

    const found = await svc.findOne(c.id);
    expect(found.ccEmails.map((e) => e.email).sort()).toEqual(['finance@example.com', 'ops@example.com']);
  });

  it('replaces CC emails on update', async () => {
    const created = await svc.create({
      companyName: 'X', address: 'addr', primaryEmail: 'x@example.com',
      ccEmails: ['a@example.com'], registrationNumber: undefined, phone: undefined, notes: undefined,
    });
    await svc.update(created.id, {
      companyName: 'X', address: 'addr', primaryEmail: 'x@example.com',
      ccEmails: ['b@example.com', 'c@example.com'],
      registrationNumber: undefined, phone: undefined, notes: undefined,
    });
    const after = await svc.findOne(created.id);
    expect(after.ccEmails.map((e) => e.email).sort()).toEqual(['b@example.com', 'c@example.com']);
  });
});
