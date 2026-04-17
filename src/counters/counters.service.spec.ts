import { Test } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { CountersModule } from './counters.module';
import { CountersService } from './counters.service';
import { buildTypeOrmOptions } from '../config/typeorm.options';
import { validateEnv } from '../config/env.validation';

describe('CountersService (integration)', () => {
  let svc: CountersService;
  let ds: DataSource;
  const YEAR = 9999; // unused year for isolation

  beforeAll(async () => {
    const mod = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
        TypeOrmModule.forRootAsync({
          inject: [ConfigService],
          useFactory: (config: ConfigService) => buildTypeOrmOptions(config),
        }),
        CountersModule,
      ],
    }).compile();
    svc = mod.get(CountersService);
    ds = mod.get(DataSource);
    await ds.query('DELETE FROM invoice_counters WHERE year = ?', [YEAR]);
  });

  afterAll(async () => { await ds.destroy(); });

  it('claimNext returns 1 for a fresh year, then 2, then 3', async () => {
    const a = await svc.claimNext(YEAR); expect(a).toBe(1);
    const b = await svc.claimNext(YEAR); expect(b).toBe(2);
    const c = await svc.claimNext(YEAR); expect(c).toBe(3);
  });

  it('getCurrent returns the last claimed number', async () => {
    expect(await svc.getCurrent(YEAR)).toBe(3);
  });

  it('reset rolls last_number back to 0', async () => {
    await svc.reset(YEAR);
    expect(await svc.getCurrent(YEAR)).toBe(0);
    expect(await svc.claimNext(YEAR)).toBe(1);
  });
});
