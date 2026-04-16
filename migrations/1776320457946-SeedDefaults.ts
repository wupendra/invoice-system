import { MigrationInterface, QueryRunner } from 'typeorm';
import * as bcrypt from 'bcrypt';

export class SeedDefaults1776320457946 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO settings (
        id, vat_rate, currency_label,
        from_company_name, from_address, from_pan, from_email,
        bank_details,
        contact_name, contact_email, contact_phone,
        logo_path
      ) VALUES (
        1, 13.00, 'rupees',
        'Aquester Solutions Pvt. Ltd.',
        'paknajol-16, Sorakhutte,\\nKathmandu, Nepal',
        '605533376',
        'enquiry@aquester.com',
        'Invoice Clearance through cash or valid cheque to Aquester Solutions Pvt. Ltd.\\nGlobal IME Bank, Thamel Branch, Account No:0901010000451',
        'Kamal Raj Silwal', 'kamal@aquester.com', '9841588209',
        'public/logo.png'
      )
    `);

    const hash = await bcrypt.hash('changeme', 10);
    await queryRunner.query(
      `INSERT INTO users (email, password_hash, role) VALUES (?, ?, 'admin')`,
      ['kamal@aquester.com', hash],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM users WHERE email = 'kamal@aquester.com'`);
    await queryRunner.query(`DELETE FROM settings WHERE id = 1`);
  }
}
