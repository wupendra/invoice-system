import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Customer } from '../entities/customer.entity';
import { CustomerCcEmail } from '../entities/customer-cc-email.entity';
import { CustomersService } from './customers.service';

@Module({
  imports: [TypeOrmModule.forFeature([Customer, CustomerCcEmail])],
  providers: [CustomersService],
  exports: [CustomersService],
})
export class CustomersModule {}
