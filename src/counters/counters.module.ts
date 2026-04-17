import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InvoiceCounter } from '../entities/invoice-counter.entity';
import { CountersService } from './counters.service';
import { CountersController } from './counters.controller';

@Module({
  imports: [TypeOrmModule.forFeature([InvoiceCounter])],
  controllers: [CountersController],
  providers: [CountersService],
  exports: [CountersService],
})
export class CountersModule {}
