import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InvoiceCounter } from '../entities/invoice-counter.entity';
import { CountersService } from './counters.service';

@Module({
  imports: [TypeOrmModule.forFeature([InvoiceCounter])],
  providers: [CountersService],
  exports: [CountersService],
})
export class CountersModule {}
