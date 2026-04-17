import {
  Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, OneToMany,
  PrimaryGeneratedColumn, Unique, UpdateDateColumn,
} from 'typeorm';
import { Customer } from './customer.entity';
import { User } from './user.entity';
import { InvoiceItem } from './invoice-item.entity';

export type InvoiceStatus = 'draft' | 'sent' | 'corrected';

@Entity('invoices')
@Unique('uq_invoice_year_number', ['year', 'invoiceNumber'])
export class Invoice {
  @PrimaryGeneratedColumn() id!: number;
  @Column({ unique: true, length: 36 }) uuid!: string;
  @Column({ name: 'invoice_number', type: 'int' }) invoiceNumber!: number;
  @Column({ type: 'int' }) year!: number;

  @Column({ name: 'customer_id' }) customerId!: number;
  @ManyToOne(() => Customer) @JoinColumn({ name: 'customer_id' }) customer!: Customer;

  @Column({ name: 'invoice_date', type: 'date' }) invoiceDate!: string;

  @Column({ type: 'decimal', precision: 12, scale: 2 }) subtotal!: string;
  @Column({ name: 'vat_rate', type: 'decimal', precision: 5, scale: 2 }) vatRate!: string;
  @Column({ name: 'vat_amount', type: 'decimal', precision: 12, scale: 2 }) vatAmount!: string;
  @Column({ name: 'grand_total', type: 'decimal', precision: 12, scale: 2 }) grandTotal!: string;

  @Column({ name: 'amount_in_words', type: 'text' }) amountInWords!: string;

  @Column({ type: 'enum', enum: ['draft', 'sent', 'corrected'], default: 'draft' })
  status!: InvoiceStatus;

  @Column({ name: 'sent_at', type: 'datetime', nullable: true }) sentAt?: Date;
  @Column({ type: 'int', default: 1 }) revision!: number;

  @Column({ name: 'created_by' }) createdBy!: number;
  @ManyToOne(() => User) @JoinColumn({ name: 'created_by' }) creator!: User;

  @CreateDateColumn({ name: 'created_at' }) createdAt!: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt!: Date;

  @OneToMany(() => InvoiceItem, (i) => i.invoice, { cascade: true })
  items!: InvoiceItem[];
}
