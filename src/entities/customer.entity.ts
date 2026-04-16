import {
  Column, CreateDateColumn, Entity, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn,
} from 'typeorm';
import { CustomerCcEmail } from './customer-cc-email.entity';

@Entity('customers')
export class Customer {
  @PrimaryGeneratedColumn() id!: number;
  @Column({ name: 'company_name', length: 255 }) companyName!: string;
  @Column({ name: 'registration_number', length: 64, nullable: true }) registrationNumber?: string;
  @Column({ type: 'text' }) address!: string;
  @Column({ name: 'primary_email', length: 255 }) primaryEmail!: string;
  @Column({ length: 64, nullable: true }) phone?: string;
  @Column({ type: 'text', nullable: true }) notes?: string;
  @CreateDateColumn({ name: 'created_at' }) createdAt!: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt!: Date;

  @OneToMany(() => CustomerCcEmail, (cc) => cc.customer, { cascade: true })
  ccEmails!: CustomerCcEmail[];
}
