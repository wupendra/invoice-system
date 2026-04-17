import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddInvoiceUuid1776406439570 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add column nullable first so existing rows can be backfilled
    await queryRunner.query(`ALTER TABLE invoices ADD COLUMN uuid VARCHAR(36) NULL`);
    // Backfill existing rows with MySQL's built-in UUID()
    await queryRunner.query(`UPDATE invoices SET uuid = UUID() WHERE uuid IS NULL`);
    // Tighten: NOT NULL + unique index
    await queryRunner.query(`ALTER TABLE invoices MODIFY COLUMN uuid VARCHAR(36) NOT NULL`);
    await queryRunner.query(`CREATE UNIQUE INDEX uq_invoices_uuid ON invoices (uuid)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX uq_invoices_uuid ON invoices`);
    await queryRunner.query(`ALTER TABLE invoices DROP COLUMN uuid`);
  }
}
