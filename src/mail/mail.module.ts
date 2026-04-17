import { Module } from '@nestjs/common';
import { MailService } from './mail.service';
import { MailController } from './mail.controller';
import { InvoicesModule } from '../invoices/invoices.module';
import { CustomersModule } from '../customers/customers.module';
import { SettingsModule } from '../settings/settings.module';

@Module({
  imports: [InvoicesModule, CustomersModule, SettingsModule],
  providers: [MailService],
  controllers: [MailController],
  exports: [MailService],
})
export class MailModule {}
