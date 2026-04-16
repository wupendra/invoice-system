import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Invoice } from './invoice.entity';

@Entity('invoice_revisions')
export class InvoiceRevision {
  @PrimaryGeneratedColumn() id!: number;
  @Column({ name: 'invoice_id' }) invoiceId!: number;
  @ManyToOne(() => Invoice, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'invoice_id' }) invoice!: Invoice;

  @Column({ name: 'revision_number', type: 'int' }) revisionNumber!: number;
  @Column({ name: 'snapshot_json', type: 'json' }) snapshotJson!: any;
  @Column({ name: 'pdf_path', length: 512 }) pdfPath!: string;
  @CreateDateColumn({ name: 'created_at' }) createdAt!: Date;
}
