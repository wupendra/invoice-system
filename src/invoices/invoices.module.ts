import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Invoice } from '../entities/invoice.entity';
import { InvoiceItem } from '../entities/invoice-item.entity';
import { InvoicesService } from './invoices.service';
import { InvoicesController } from './invoices.controller';
import { CountersModule } from '../counters/counters.module';
import { SettingsModule } from '../settings/settings.module';
import { PdfModule } from '../pdf/pdf.module';
import { CustomersModule } from '../customers/customers.module';

@Module({
  imports: [TypeOrmModule.forFeature([Invoice, InvoiceItem]), CountersModule, SettingsModule, PdfModule, CustomersModule],
  providers: [InvoicesService],
  controllers: [InvoicesController],
  exports: [InvoicesService],
})
export class InvoicesModule {}
