import { Repository } from 'typeorm';
import { Settings } from '../entities/settings.entity';
import { SettingsService } from './settings.service';

describe('SettingsService (unit)', () => {
  it('returns the seeded row from get()', async () => {
    const fakeRepo = { findOne: jest.fn().mockResolvedValue({ id: 1, vatRate: '13.00' }) } as unknown as Repository<Settings>;
    const svc = new SettingsService(fakeRepo);
    const result = await svc.get();
    expect(result.vatRate).toBe('13.00');
  });

  it('throws if the singleton row is missing', async () => {
    const fakeRepo = { findOne: jest.fn().mockResolvedValue(null) } as unknown as Repository<Settings>;
    const svc = new SettingsService(fakeRepo);
    await expect(svc.get()).rejects.toThrow(/Settings row missing/);
  });

  it('updates and returns the row from update()', async () => {
    const row = { id: 1, vatRate: '13.00' } as Settings;
    const fakeRepo = {
      findOne: jest.fn().mockResolvedValue(row),
      save: jest.fn().mockImplementation(async (s: Settings) => s),
    } as unknown as Repository<Settings>;
    const svc = new SettingsService(fakeRepo);
    const result = await svc.update({ vatRate: '15.00' } as any);
    expect(result.vatRate).toBe('15.00');
    expect(fakeRepo.save).toHaveBeenCalled();
  });
});