import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, ILike, Repository } from 'typeorm';
import { Customer } from '../entities/customer.entity';
import { CustomerCcEmail } from '../entities/customer-cc-email.entity';
import { CustomerDto } from './dto/customer.dto';

@Injectable()
export class CustomersService {
  constructor(
    @InjectRepository(Customer) private readonly customers: Repository<Customer>,
    @InjectRepository(CustomerCcEmail) private readonly ccEmails: Repository<CustomerCcEmail>,
    @InjectDataSource() private readonly ds: DataSource,
  ) {}

  list(search?: string) {
    return this.customers.find({
      where: search ? { companyName: ILike(`%${search}%`) } : {},
      order: { companyName: 'ASC' },
    });
  }

  async findOne(id: number): Promise<Customer> {
    const c = await this.customers.findOne({ where: { id }, relations: ['ccEmails'] });
    if (!c) throw new NotFoundException(`Customer ${id} not found`);
    return c;
  }

  create(dto: CustomerDto): Promise<Customer> {
    return this.ds.transaction(async (tx) => {
      const repo = tx.getRepository(Customer);
      const ccRepo = tx.getRepository(CustomerCcEmail);
      const customer = await repo.save(repo.create({
        companyName: dto.companyName,
        registrationNumber: dto.registrationNumber,
        address: dto.address,
        primaryEmail: dto.primaryEmail,
        phone: dto.phone,
        notes: dto.notes,
      }));
      if (dto.ccEmails.length > 0) {
        await ccRepo.save(dto.ccEmails.map((email) => ({ customerId: customer.id, email })));
      }
      return repo.findOneOrFail({ where: { id: customer.id }, relations: ['ccEmails'] });
    });
  }

  async update(id: number, dto: CustomerDto): Promise<Customer> {
    return this.ds.transaction(async (tx) => {
      const repo = tx.getRepository(Customer);
      const ccRepo = tx.getRepository(CustomerCcEmail);
      const customer = await repo.findOne({ where: { id } });
      if (!customer) throw new NotFoundException(`Customer ${id} not found`);
      Object.assign(customer, {
        companyName: dto.companyName,
        registrationNumber: dto.registrationNumber,
        address: dto.address,
        primaryEmail: dto.primaryEmail,
        phone: dto.phone,
        notes: dto.notes,
      });
      await repo.save(customer);
      await ccRepo.delete({ customerId: id });
      if (dto.ccEmails.length > 0) {
        await ccRepo.save(dto.ccEmails.map((email) => ({ customerId: id, email })));
      }
      return repo.findOneOrFail({ where: { id }, relations: ['ccEmails'] });
    });
  }
}
