import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('settings')
export class Settings {
  @PrimaryColumn({ type: 'int', default: 1 }) id!: number;

  @Column({ name: 'vat_rate', type: 'decimal', precision: 5, scale: 2, default: 13 }) vatRate!: string;
  @Column({ name: 'currency_label', length: 32, default: 'rupees' }) currencyLabel!: string;

  @Column({ name: 'from_company_name', length: 255 }) fromCompanyName!: string;
  @Column({ name: 'from_address', type: 'text' }) fromAddress!: string;
  @Column({ name: 'from_pan', length: 64 }) fromPan!: string;
  @Column({ name: 'from_email', length: 255 }) fromEmail!: string;

  @Column({ name: 'bank_details', type: 'text' }) bankDetails!: string;

  @Column({ name: 'contact_name', length: 255 }) contactName!: string;
  @Column({ name: 'contact_email', length: 255 }) contactEmail!: string;
  @Column({ name: 'contact_phone', length: 64 }) contactPhone!: string;

  @Column({ name: 'logo_path', length: 512, default: 'public/logo.png' }) logoPath!: string;
}
