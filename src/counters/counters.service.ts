import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { InvoiceCounter } from '../entities/invoice-counter.entity';

@Injectable()
export class CountersService {
  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  /** Atomic: read-with-lock, insert if missing, increment, return claimed number. */
  claimNext(year: number, manager?: EntityManager): Promise<number> {
    const run = async (mgr: EntityManager) => {
      const repo = mgr.getRepository(InvoiceCounter);
      let row = await repo
        .createQueryBuilder('c')
        .setLock('pessimistic_write')
        .where('c.year = :year', { year })
        .getOne();
      if (!row) {
        await repo.insert({ year, lastNumber: 0 });
        row = await repo
          .createQueryBuilder('c')
          .setLock('pessimistic_write')
          .where('c.year = :year', { year })
          .getOneOrFail();
      }
      row.lastNumber += 1;
      await repo.save(row);
      return row.lastNumber;
    };
    return manager ? run(manager) : this.ds.transaction(run);
  }

  async getCurrent(year: number): Promise<number> {
    const row = await this.ds.getRepository(InvoiceCounter).findOne({ where: { year } });
    return row?.lastNumber ?? 0;
  }

  async reset(year: number): Promise<void> {
    const repo = this.ds.getRepository(InvoiceCounter);
    const row = await repo.findOne({ where: { year } });
    if (!row) {
      await repo.insert({ year, lastNumber: 0 });
    } else {
      row.lastNumber = 0;
      await repo.save(row);
    }
  }
}
