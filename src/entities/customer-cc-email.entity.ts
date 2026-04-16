import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Customer } from './customer.entity';

@Entity('customer_cc_emails')
export class CustomerCcEmail {
  @PrimaryGeneratedColumn() id!: number;
  @Column({ name: 'customer_id' }) customerId!: number;
  @Column({ length: 255 }) email!: string;

  @ManyToOne(() => Customer, (c) => c.ccEmails, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'customer_id' }) customer!: Customer;
}
