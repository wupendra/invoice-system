import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Invoice } from '../entities/invoice.entity';
import { InvoiceItem } from '../entities/invoice-item.entity';
import { InvoicesService } from './invoices.service';
import { CountersModule } from '../counters/counters.module';
import { SettingsModule } from '../settings/settings.module';

@Module({
  imports: [TypeOrmModule.forFeature([Invoice, InvoiceItem]), CountersModule, SettingsModule],
  providers: [InvoicesService],
  exports: [InvoicesService],
})
export class InvoicesModule {}
