import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Invoice } from './invoice.entity';

@Entity('invoice_items')
export class InvoiceItem {
  @PrimaryGeneratedColumn() id!: number;
  @Column({ name: 'invoice_id' }) invoiceId!: number;
  @ManyToOne(() => Invoice, (inv) => inv.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'invoice_id' }) invoice!: Invoice;

  @Column({ name: 'sort_order', type: 'int' }) sortOrder!: number;
  @Column({ name: 'item_name', length: 255 }) itemName!: string;
  @Column({ type: 'text' }) description!: string;
  @Column({ name: 'unit_cost', type: 'decimal', precision: 12, scale: 2 }) unitCost!: string;
  @Column({ type: 'decimal', precision: 10, scale: 2 }) quantity!: string;
  @Column({ name: 'quantity_note', length: 255, nullable: true }) quantityNote?: string;
  @Column({ name: 'line_total', type: 'decimal', precision: 12, scale: 2 }) lineTotal!: string;
}
