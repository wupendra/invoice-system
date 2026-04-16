import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialSchema1776320049936 implements MigrationInterface {
    name = 'InitialSchema1776320049936'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE \`users\` (\`id\` int NOT NULL AUTO_INCREMENT, \`email\` varchar(255) NOT NULL, \`password_hash\` varchar(255) NOT NULL, \`role\` enum ('admin', 'viewer') NOT NULL, \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), UNIQUE INDEX \`IDX_97672ac88f789774dd47f7c8be\` (\`email\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`settings\` (\`id\` int NOT NULL DEFAULT '1', \`vat_rate\` decimal(5,2) NOT NULL DEFAULT '13.00', \`currency_label\` varchar(32) NOT NULL DEFAULT 'rupees', \`from_company_name\` varchar(255) NOT NULL, \`from_address\` text NOT NULL, \`from_pan\` varchar(64) NOT NULL, \`from_email\` varchar(255) NOT NULL, \`bank_details\` text NOT NULL, \`contact_name\` varchar(255) NOT NULL, \`contact_email\` varchar(255) NOT NULL, \`contact_phone\` varchar(64) NOT NULL, \`logo_path\` varchar(512) NOT NULL DEFAULT 'public/logo.png', PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`customer_cc_emails\` (\`id\` int NOT NULL AUTO_INCREMENT, \`customer_id\` int NOT NULL, \`email\` varchar(255) NOT NULL, PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`customers\` (\`id\` int NOT NULL AUTO_INCREMENT, \`company_name\` varchar(255) NOT NULL, \`registration_number\` varchar(64) NULL, \`address\` text NOT NULL, \`primary_email\` varchar(255) NOT NULL, \`phone\` varchar(64) NULL, \`notes\` text NULL, \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`invoice_items\` (\`id\` int NOT NULL AUTO_INCREMENT, \`invoice_id\` int NOT NULL, \`sort_order\` int NOT NULL, \`item_name\` varchar(255) NOT NULL, \`description\` text NOT NULL, \`unit_cost\` decimal(12,2) NOT NULL, \`quantity\` decimal(10,2) NOT NULL, \`quantity_note\` varchar(255) NULL, \`line_total\` decimal(12,2) NOT NULL, PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`invoices\` (\`id\` int NOT NULL AUTO_INCREMENT, \`invoice_number\` int NOT NULL, \`year\` int NOT NULL, \`customer_id\` int NOT NULL, \`invoice_date\` date NOT NULL, \`subtotal\` decimal(12,2) NOT NULL, \`vat_rate\` decimal(5,2) NOT NULL, \`vat_amount\` decimal(12,2) NOT NULL, \`grand_total\` decimal(12,2) NOT NULL, \`amount_in_words\` text NOT NULL, \`status\` enum ('draft', 'sent', 'corrected') NOT NULL DEFAULT 'draft', \`sent_at\` datetime NULL, \`revision\` int NOT NULL DEFAULT '1', \`created_by\` int NOT NULL, \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), UNIQUE INDEX \`uq_invoice_year_number\` (\`year\`, \`invoice_number\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`invoice_revisions\` (\`id\` int NOT NULL AUTO_INCREMENT, \`invoice_id\` int NOT NULL, \`revision_number\` int NOT NULL, \`snapshot_json\` json NOT NULL, \`pdf_path\` varchar(512) NOT NULL, \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`invoice_counters\` (\`year\` int NOT NULL, \`last_number\` int NOT NULL DEFAULT '0', PRIMARY KEY (\`year\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`email_logs\` (\`id\` int NOT NULL AUTO_INCREMENT, \`invoice_id\` int NOT NULL, \`to_email\` varchar(255) NOT NULL, \`cc_emails_json\` json NOT NULL, \`subject\` varchar(512) NOT NULL, \`body_html\` mediumtext NOT NULL, \`sent_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`sent_by\` int NOT NULL, PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`ALTER TABLE \`customer_cc_emails\` ADD CONSTRAINT \`FK_7e2e80e2505d168dc6e4644d3f9\` FOREIGN KEY (\`customer_id\`) REFERENCES \`customers\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`invoice_items\` ADD CONSTRAINT \`FK_dc991d555664682cfe892eea2c1\` FOREIGN KEY (\`invoice_id\`) REFERENCES \`invoices\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`invoices\` ADD CONSTRAINT \`FK_65e3145f317bd655481d3f96c74\` FOREIGN KEY (\`customer_id\`) REFERENCES \`customers\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`invoices\` ADD CONSTRAINT \`FK_39a202af5d1dd1744458820ecb5\` FOREIGN KEY (\`created_by\`) REFERENCES \`users\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`invoice_revisions\` ADD CONSTRAINT \`FK_157de43c06c3baec074e7f1e2ed\` FOREIGN KEY (\`invoice_id\`) REFERENCES \`invoices\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`email_logs\` ADD CONSTRAINT \`FK_11a84078c1aadc352a1b1111751\` FOREIGN KEY (\`invoice_id\`) REFERENCES \`invoices\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`email_logs\` ADD CONSTRAINT \`FK_d3219f71910c9602362437b45ef\` FOREIGN KEY (\`sent_by\`) REFERENCES \`users\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`email_logs\` DROP FOREIGN KEY \`FK_d3219f71910c9602362437b45ef\``);
        await queryRunner.query(`ALTER TABLE \`email_logs\` DROP FOREIGN KEY \`FK_11a84078c1aadc352a1b1111751\``);
        await queryRunner.query(`ALTER TABLE \`invoice_revisions\` DROP FOREIGN KEY \`FK_157de43c06c3baec074e7f1e2ed\``);
        await queryRunner.query(`ALTER TABLE \`invoices\` DROP FOREIGN KEY \`FK_39a202af5d1dd1744458820ecb5\``);
        await queryRunner.query(`ALTER TABLE \`invoices\` DROP FOREIGN KEY \`FK_65e3145f317bd655481d3f96c74\``);
        await queryRunner.query(`ALTER TABLE \`invoice_items\` DROP FOREIGN KEY \`FK_dc991d555664682cfe892eea2c1\``);
        await queryRunner.query(`ALTER TABLE \`customer_cc_emails\` DROP FOREIGN KEY \`FK_7e2e80e2505d168dc6e4644d3f9\``);
        await queryRunner.query(`DROP TABLE \`email_logs\``);
        await queryRunner.query(`DROP TABLE \`invoice_counters\``);
        await queryRunner.query(`DROP TABLE \`invoice_revisions\``);
        await queryRunner.query(`DROP INDEX \`uq_invoice_year_number\` ON \`invoices\``);
        await queryRunner.query(`DROP TABLE \`invoices\``);
        await queryRunner.query(`DROP TABLE \`invoice_items\``);
        await queryRunner.query(`DROP TABLE \`customers\``);
        await queryRunner.query(`DROP TABLE \`customer_cc_emails\``);
        await queryRunner.query(`DROP TABLE \`settings\``);
        await queryRunner.query(`DROP INDEX \`IDX_97672ac88f789774dd47f7c8be\` ON \`users\``);
        await queryRunner.query(`DROP TABLE \`users\``);
    }

}
