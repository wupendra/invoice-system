import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('invoice_counters')
export class InvoiceCounter {
  @PrimaryColumn({ type: 'int' }) year!: number;
  @Column({ name: 'last_number', type: 'int', default: 0 }) lastNumber!: number;
}
