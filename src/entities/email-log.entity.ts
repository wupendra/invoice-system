import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Invoice } from './invoice.entity';
import { User } from './user.entity';

@Entity('email_logs')
export class EmailLog {
  @PrimaryGeneratedColumn() id!: number;
  @Column({ name: 'invoice_id' }) invoiceId!: number;
  @ManyToOne(() => Invoice, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'invoice_id' }) invoice!: Invoice;

  @Column({ name: 'to_email', length: 255 }) toEmail!: string;
  @Column({ name: 'cc_emails_json', type: 'json' }) ccEmailsJson!: string[];
  @Column({ length: 512 }) subject!: string;
  @Column({ name: 'body_html', type: 'mediumtext' }) bodyHtml!: string;
  @CreateDateColumn({ name: 'sent_at' }) sentAt!: Date;
  @Column({ name: 'sent_by' }) sentBy!: number;
  @ManyToOne(() => User) @JoinColumn({ name: 'sent_by' }) sender!: User;
}
