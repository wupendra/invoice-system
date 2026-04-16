1# Aquester Invoice — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a NestJS invoicing tool that manages customers, generates pixel-perfect PDF invoices, and emails them via Gmail SMTP.

**Architecture:** Single NestJS monolith. Server-rendered Handlebars pages (Alpine.js for the dynamic invoice form). TypeORM + MySQL with checked-in migrations. Puppeteer renders the same Handlebars invoice template to PDF. Nodemailer + Gmail SMTP. JWT-in-cookie auth with admin/viewer roles.

**Tech Stack:** NestJS, TypeScript, TypeORM, MySQL, Handlebars, Alpine.js, Puppeteer, Nodemailer, Passport-JWT, bcrypt, class-validator, Jest, Supertest

**Spec:** `docs/superpowers/specs/2026-04-16-aquester-invoice-design.md`

**Phases:**
- **Phase 1 — Foundation:** project bootstrap, DB schema, auth (login/logout, role guards). Ships a runnable app you can log in to.
- **Phase 2 — Settings & Customers:** admin can edit company settings and full customer CRUD.
- **Phase 3 — Invoices & PDF:** create/view/list invoices, Puppeteer PDF generation, counter management.
- **Phase 4 — Edit, Email & Polish:** edit-with-revision flow, email preview & send, error pages, README.

---

## File Structure

```
.gitignore
.env.example
package.json
tsconfig.json
nest-cli.json
jest.config.ts
README.md
public/
  logo.png                  (Aquester logo)
  styles.css                (shared admin CSS)
  alpine.min.js             (vendored Alpine.js)
views/
  layouts/main.hbs          (admin chrome: nav, flash messages)
  partials/
    flash.hbs               (success/error flash messages)
    nav.hbs                 (top nav, role-aware)
  pages/
    login.hbs
    dashboard.hbs
    customers/{list,form,detail}.hbs
    invoices/{list,form,view,email}.hbs
    settings/{form,counter}.hbs
    users/{list,form}.hbs
    errors/{404,403,500}.hbs
  invoice-pdf.hbs           (the printable invoice template — used by both /invoices/:id view and Puppeteer)
storage/
  invoices/                 (generated PDFs — git-ignored)
migrations/
  1700000000000-InitialSchema.ts
  1700000000001-SeedDefaults.ts
src/
  main.ts                   (bootstrap, hbs view engine, cookie-parser)
  app.module.ts             (root module)
  config/
    typeorm.config.ts       (DataSource for migrations CLI)
    env.validation.ts       (class-validator schema for env vars)
  common/
    decorators/{public.decorator.ts,roles.decorator.ts,current-user.decorator.ts}
    guards/{jwt-auth.guard.ts,roles.guard.ts}
    helpers/
      money.ts              (line-total/subtotal/vat/grand-total math)
      money.spec.ts
      amount-in-words.ts    (number-to-words wrapper, currency suffix)
      amount-in-words.spec.ts
      date-format.ts        ("22nd Sep 2025" formatter)
      date-format.spec.ts
    filters/http-exception.filter.ts (renders 403/404/500 hbs pages)
    middleware/flash.middleware.ts   (one-shot flash messages via cookie)
  entities/
    user.entity.ts
    customer.entity.ts
    customer-cc-email.entity.ts
    invoice.entity.ts
    invoice-item.entity.ts
    invoice-revision.entity.ts
    email-log.entity.ts
    invoice-counter.entity.ts
    settings.entity.ts
  auth/
    auth.module.ts
    auth.controller.ts      (GET/POST /login, POST /logout)
    auth.service.ts         (validateUser, signToken)
    jwt.strategy.ts         (extracts JWT from aq_token cookie)
    dto/login.dto.ts
    bcrypt.helper.ts
    bcrypt.helper.spec.ts
  users/
    users.module.ts
    users.controller.ts     (admin-only CRUD)
    users.service.ts
    dto/{create-user.dto.ts,update-user.dto.ts}
    users.service.spec.ts
  settings/
    settings.module.ts
    settings.controller.ts
    settings.service.ts
    dto/update-settings.dto.ts
    settings.service.spec.ts
  customers/
    customers.module.ts
    customers.controller.ts
    customers.service.ts
    dto/{customer.dto.ts}
    customers.service.spec.ts
  counters/
    counters.module.ts
    counters.controller.ts  (GET/POST /settings/counter)
    counters.service.ts     (claimNext, getCurrent, reset)
    counters.service.spec.ts
  invoices/
    invoices.module.ts
    invoices.controller.ts  (CRUD + view + pdf endpoint)
    invoices.service.ts     (create, update-with-revision)
    invoice-mapper.ts       (DB rows → view/PDF model)
    dto/{invoice.dto.ts,invoice-item.dto.ts}
    invoices.service.spec.ts
  pdf/
    pdf.module.ts
    pdf.service.ts          (Puppeteer browser singleton, render(invoiceId) → Buffer + writes file)
    pdf.service.spec.ts
  mail/
    mail.module.ts
    mail.controller.ts      (GET/POST /invoices/:id/email)
    mail.service.ts         (Nodemailer transport, buildSubject, buildBody, send)
    dto/send-email.dto.ts
    mail.service.spec.ts
test/
  e2e/
    auth.e2e-spec.ts
    customers.e2e-spec.ts
    invoices.e2e-spec.ts
    edit-revision.e2e-spec.ts
    email.e2e-spec.ts
    jest-e2e.json
    test-helpers.ts         (login as admin/viewer, seed customer)
```

---

## Conventions used in every task

- **TDD:** write failing test → run → see it fail → implement → run → see it pass → commit.
- **Commits:** every task ends with `git add <paths> && git commit -m "<message>"`. Conventional commit style.
- **Tests:** Jest. Unit specs co-located with source (`*.spec.ts`). E2E specs under `test/e2e/`.
- **Run a single test:** `npx jest <path> -t "<name>"`
- **Run all unit tests:** `npm test`
- **Run E2E tests:** `npm run test:e2e`
- **Run dev server:** `npm run start:dev` (port from `APP_PORT`, default 3000)

---

# PHASE 1 — Foundation

End state: a working NestJS app with MySQL connected, Handlebars rendering, login form working, JWT cookie issued, and an admin user seeded. Logging in as admin lands on `/dashboard` (placeholder); viewer login also works; admin-only routes return 403 for viewers.

---

### Task 1.1: Bootstrap NestJS project

**Files:**
- Create: `package.json`, `tsconfig.json`, `tsconfig.build.json`, `nest-cli.json`, `.eslintrc.js`, `.prettierrc`, `src/main.ts`, `src/app.module.ts`, `src/app.controller.ts`, `src/app.service.ts`, `test/app.e2e-spec.ts`, `test/jest-e2e.json`

- [ ] **Step 1: Generate the NestJS skeleton (skip git init — repo exists)**

```bash
cd /Users/wupendra/PhpstormProjects/aquester-invoice
npx -y @nestjs/cli@10 new . --skip-git --package-manager npm
```

When prompted "Which package manager would you ❤️ to use?" select `npm`. The CLI will refuse if the directory has files; if so, run with `--strict` removed and pass any extant file conflicts manually. If it complains about non-empty dir, `mv .idea /tmp/idea.bak`, run, then `mv /tmp/idea.bak .idea`. Leave the `docs/` and `.git` folders in place.

- [ ] **Step 2: Verify the app builds and the smoke test passes**

```bash
npm run build
npm test
```

Expected: build succeeds; the generated `app.controller.spec.ts` passes (`Tests: 1 passed`).

- [ ] **Step 3: Commit**

```bash
git add .
git commit -m "chore: scaffold NestJS project"
```

---

### Task 1.2: Add core dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install runtime deps**

```bash
npm install \
  @nestjs/typeorm typeorm mysql2 \
  @nestjs/config class-validator class-transformer \
  @nestjs/passport passport passport-jwt @nestjs/jwt bcrypt \
  cookie-parser \
  hbs \
  nodemailer \
  puppeteer \
  number-to-words
```

- [ ] **Step 2: Install dev deps**

```bash
npm install -D \
  @types/passport-jwt @types/bcrypt @types/cookie-parser \
  @types/nodemailer @types/number-to-words \
  ts-node
```

- [ ] **Step 3: Verify install + build still works**

```bash
npm run build
```

Expected: build succeeds (no type errors).

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add runtime deps (typeorm, jwt, hbs, puppeteer, nodemailer)"
```

---

### Task 1.3: Add `.gitignore` and `.env.example`

**Files:**
- Create: `.gitignore`, `.env.example`

- [ ] **Step 1: Write `.gitignore`**

```gitignore
# deps
node_modules/

# build
dist/

# logs
*.log
npm-debug.log*

# env
.env
.env.local

# storage
storage/

# editor
.idea/
.vscode/
*.iml

# test
coverage/
```

- [ ] **Step 2: Write `.env.example`**

```bash
APP_PORT=3000

JWT_SECRET=change-me-to-a-long-random-string
JWT_EXPIRES=12h
COOKIE_SECURE=false

DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASS=
DB_NAME=aquester_invoice

SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_USER=u.silwal@gmail.com
SMTP_PASS=app-password-here
SMTP_FROM=Aquester Solutions <u.silwal@gmail.com>

PDF_STORAGE_DIR=./storage/invoices
```

- [ ] **Step 3: Copy to `.env` for local dev**

```bash
cp .env.example .env
```

Edit `.env` to put your real local MySQL credentials in `DB_USER`/`DB_PASS`/`DB_NAME`. The DB doesn't need to exist yet — we create it in Task 1.5.

- [ ] **Step 4: Commit**

```bash
git add .gitignore .env.example
git commit -m "chore: add .gitignore and .env.example"
```

---

### Task 1.4: Configure env loading + validation

**Files:**
- Create: `src/config/env.validation.ts`
- Modify: `src/app.module.ts`

- [ ] **Step 1: Write env validation**

`src/config/env.validation.ts`:

```typescript
import { plainToInstance } from 'class-transformer';
import { IsBooleanString, IsInt, IsOptional, IsString, validateSync } from 'class-validator';

export class EnvVars {
  @IsInt() APP_PORT!: number;

  @IsString() JWT_SECRET!: string;
  @IsString() JWT_EXPIRES!: string;
  @IsBooleanString() COOKIE_SECURE!: string;

  @IsString() DB_HOST!: string;
  @IsInt() DB_PORT!: number;
  @IsString() DB_USER!: string;
  @IsOptional() @IsString() DB_PASS?: string;
  @IsString() DB_NAME!: string;

  @IsString() SMTP_HOST!: string;
  @IsInt() SMTP_PORT!: number;
  @IsString() SMTP_USER!: string;
  @IsString() SMTP_PASS!: string;
  @IsString() SMTP_FROM!: string;

  @IsString() PDF_STORAGE_DIR!: string;
}

export function validateEnv(config: Record<string, unknown>) {
  const validated = plainToInstance(EnvVars, config, { enableImplicitConversion: true });
  const errors = validateSync(validated, { skipMissingProperties: false });
  if (errors.length) throw new Error(errors.toString());
  return validated;
}
```

- [ ] **Step 2: Wire ConfigModule into `AppModule`**

Replace `src/app.module.ts` with:

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { validateEnv } from './config/env.validation';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
    }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
```

- [ ] **Step 3: Verify the app starts**

```bash
npm run start
```

Expected: logs `Nest application successfully started`. Ctrl+C to stop.

If it crashes with validation errors, check that every key in `.env.example` is also in your `.env`.

- [ ] **Step 4: Commit**

```bash
git add src/config/env.validation.ts src/app.module.ts
git commit -m "feat(config): add env validation"
```

---

### Task 1.5: Configure TypeORM with MySQL

**Files:**
- Create: `src/config/typeorm.config.ts`, `src/config/typeorm.options.ts`
- Modify: `src/app.module.ts`, `package.json` (add migration scripts)

- [ ] **Step 1: Create the local DB**

```bash
mysql -uroot -p -e "CREATE DATABASE IF NOT EXISTS aquester_invoice CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
```

(Replace `-uroot -p` with whatever creds you use locally.) Verify the DB name matches `.env`'s `DB_NAME`.

- [ ] **Step 2: Write typeorm options factory**

`src/config/typeorm.options.ts`:

```typescript
import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';

export function buildTypeOrmOptions(config: ConfigService): TypeOrmModuleOptions {
  return {
    type: 'mysql',
    host: config.get<string>('DB_HOST'),
    port: Number(config.get<string>('DB_PORT')),
    username: config.get<string>('DB_USER'),
    password: config.get<string>('DB_PASS') || '',
    database: config.get<string>('DB_NAME'),
    entities: [__dirname + '/../entities/*.entity.{ts,js}'],
    migrations: [__dirname + '/../../migrations/*.{ts,js}'],
    synchronize: false,
    charset: 'utf8mb4',
    logging: ['error', 'warn'],
  };
}
```

- [ ] **Step 3: Write standalone DataSource for the migrations CLI**

`src/config/typeorm.config.ts`:

```typescript
import 'dotenv/config';
import { DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { buildTypeOrmOptions } from './typeorm.options';

const config = new ConfigService(process.env as Record<string, string>);
export default new DataSource(buildTypeOrmOptions(config) as any);
```

- [ ] **Step 4: Add migration scripts to `package.json`**

In the `scripts` block of `package.json` add:

```json
"typeorm": "typeorm-ts-node-commonjs",
"migration:generate": "npm run typeorm -- migration:generate -d src/config/typeorm.config.ts",
"migration:create": "npm run typeorm -- migration:create",
"migration:run": "npm run typeorm -- migration:run -d src/config/typeorm.config.ts",
"migration:revert": "npm run typeorm -- migration:revert -d src/config/typeorm.config.ts"
```

Also install `dotenv` (used by the standalone DataSource):

```bash
npm install dotenv
```

- [ ] **Step 5: Wire TypeOrmModule into AppModule**

Replace `src/app.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { validateEnv } from './config/env.validation';
import { buildTypeOrmOptions } from './config/typeorm.options';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => buildTypeOrmOptions(config),
    }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
```

- [ ] **Step 6: Verify the app connects to MySQL**

```bash
npm run start
```

Expected: logs include `query: SELECT VERSION() AS \`version\`` (TypeORM probe) and `Nest application successfully started`. If it fails: check creds and that the database exists.

- [ ] **Step 7: Commit**

```bash
git add src/config/ src/app.module.ts package.json package-lock.json
git commit -m "feat(db): connect TypeORM to MySQL with migration scripts"
```

---

### Task 1.6: Add entity classes (all 9 tables)

**Files:**
- Create: `src/entities/user.entity.ts`, `customer.entity.ts`, `customer-cc-email.entity.ts`, `invoice.entity.ts`, `invoice-item.entity.ts`, `invoice-revision.entity.ts`, `email-log.entity.ts`, `invoice-counter.entity.ts`, `settings.entity.ts`

These are pure ORM entity definitions. No tests yet — the schema is exercised by the migration in 1.7 and by every later module.

- [ ] **Step 1: User**

`src/entities/user.entity.ts`:

```typescript
import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

export type UserRole = 'admin' | 'viewer';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn() id!: number;
  @Column({ unique: true, length: 255 }) email!: string;
  @Column({ name: 'password_hash', length: 255 }) passwordHash!: string;
  @Column({ type: 'enum', enum: ['admin', 'viewer'] }) role!: UserRole;
  @CreateDateColumn({ name: 'created_at' }) createdAt!: Date;
}
```

- [ ] **Step 2: Customer + CustomerCcEmail**

`src/entities/customer.entity.ts`:

```typescript
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
```

`src/entities/customer-cc-email.entity.ts`:

```typescript
import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Customer } from './customer.entity';

@Entity('customer_cc_emails')
export class CustomerCcEmail {
  @PrimaryGeneratedColumn() id!: number;
  @Column({ name: 'customer_id' }) customerId!: number;
  @Column({ length: 255 }) email!: string;

  @ManyToOne(() => Customer, (c) => c.ccEmails, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'customer_id' }) customer!: Customer;
}
```

- [ ] **Step 3: Invoice + InvoiceItem**

`src/entities/invoice.entity.ts`:

```typescript
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
```

`src/entities/invoice-item.entity.ts`:

```typescript
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
```

- [ ] **Step 4: Revision, EmailLog, Counter, Settings**

`src/entities/invoice-revision.entity.ts`:

```typescript
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
```

`src/entities/email-log.entity.ts`:

```typescript
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
```

`src/entities/invoice-counter.entity.ts`:

```typescript
import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('invoice_counters')
export class InvoiceCounter {
  @PrimaryColumn({ type: 'int' }) year!: number;
  @Column({ name: 'last_number', type: 'int', default: 0 }) lastNumber!: number;
}
```

`src/entities/settings.entity.ts`:

```typescript
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
```

- [ ] **Step 5: Verify the app still builds**

```bash
npm run build
```

Expected: clean build.

- [ ] **Step 6: Commit**

```bash
git add src/entities/
git commit -m "feat(db): add entities for users, customers, invoices, settings, counters"
```

---

### Task 1.7: Create initial schema migration

**Files:**
- Create: `migrations/1700000000000-InitialSchema.ts`

- [ ] **Step 1: Generate migration from entities**

```bash
npm run migration:generate -- migrations/InitialSchema
```

This auto-creates `migrations/<timestamp>-InitialSchema.ts` containing the `CREATE TABLE` statements derived from the entities. If it errors with "no changes", confirm `entities` glob in `typeorm.options.ts` matches the entity files.

- [ ] **Step 2: Inspect the generated file**

Open the new file and confirm it has `CREATE TABLE` for: `users`, `customers`, `customer_cc_emails`, `invoices`, `invoice_items`, `invoice_revisions`, `email_logs`, `invoice_counters`, `settings`. Confirm the unique index `uq_invoice_year_number` is present.

- [ ] **Step 3: Run the migration**

```bash
npm run migration:run
```

Expected: logs `Migration InitialSchema<timestamp> has been executed successfully`. Verify in MySQL:

```bash
mysql -uroot -p aquester_invoice -e "SHOW TABLES;"
```

Expected: 9 tables + `migrations` table.

- [ ] **Step 4: Commit**

```bash
git add migrations/
git commit -m "feat(db): initial schema migration"
```

---

### Task 1.8: Seed migration (default settings + admin user)

**Files:**
- Create: `migrations/1700000000001-SeedDefaults.ts`

- [ ] **Step 1: Manually create the migration file**

```bash
npm run migration:create -- migrations/SeedDefaults
```

- [ ] **Step 2: Fill in the seed migration**

Replace the generated file body with:

```typescript
import { MigrationInterface, QueryRunner } from 'typeorm';
import * as bcrypt from 'bcrypt';

export class SeedDefaults1700000000001 implements MigrationInterface {
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
```

(Rename the class & filename to match the timestamp the CLI gave you if it differs from `1700000000001`.)

- [ ] **Step 3: Run the seed migration**

```bash
npm run migration:run
```

Expected: `Migration SeedDefaults… has been executed successfully`. Verify:

```bash
mysql -uroot -p aquester_invoice -e "SELECT id, email, role FROM users; SELECT id, vat_rate, from_company_name FROM settings;"
```

Expected: one admin row, one settings row.

- [ ] **Step 4: Commit**

```bash
git add migrations/
git commit -m "feat(db): seed default settings and admin user"
```

---

### Task 1.9: Bootstrap server: hbs view engine, cookie-parser, static assets

**Files:**
- Modify: `src/main.ts`
- Create: `views/layouts/main.hbs`, `views/partials/{nav,flash}.hbs`, `views/pages/dashboard.hbs`, `public/styles.css`, `public/logo.png` (placeholder; replace with the real logo later)

- [ ] **Step 1: Update main.ts**

```typescript
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe } from '@nestjs/common';
import * as cookieParser from 'cookie-parser';
import { join } from 'path';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get(ConfigService);

  app.useStaticAssets(join(__dirname, '..', 'public'), { prefix: '/public/' });
  app.setBaseViewsDir(join(__dirname, '..', 'views'));
  app.setViewEngine('hbs');

  // hbs partials/layouts
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const hbs = require('hbs');
  hbs.registerPartials(join(__dirname, '..', 'views', 'partials'));

  app.use(cookieParser());
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));

  const port = Number(config.get('APP_PORT'));
  await app.listen(port);
}
bootstrap();
```

- [ ] **Step 2: Add base layout + partials + dashboard placeholder**

`views/layouts/main.hbs`:

```handlebars
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>{{title}} · Aquester Invoice</title>
  <link rel="stylesheet" href="/public/styles.css"/>
</head>
<body>
  {{> nav}}
  {{> flash}}
  <main class="container">
    {{{body}}}
  </main>
</body>
</html>
```

`views/partials/nav.hbs`:

```handlebars
<header class="topnav">
  <a href="/" class="brand">Aquester Invoice</a>
  {{#if user}}
    <nav>
      <a href="/customers">Customers</a>
      <a href="/invoices">Invoices</a>
      {{#if isAdmin}}
        <a href="/settings">Settings</a>
        <a href="/users">Users</a>
      {{/if}}
      <form method="post" action="/logout" style="display:inline">
        <button type="submit" class="link">Logout ({{user.email}})</button>
      </form>
    </nav>
  {{/if}}
</header>
```

`views/partials/flash.hbs`:

```handlebars
{{#if flash.error}}<div class="flash error">{{flash.error}}</div>{{/if}}
{{#if flash.success}}<div class="flash success">{{flash.success}}</div>{{/if}}
```

`views/pages/dashboard.hbs`:

```handlebars
<h1>Dashboard</h1>
<p>Welcome, {{user.email}} ({{user.role}}).</p>
```

`public/styles.css` — minimal admin styles:

```css
*, *::before, *::after { box-sizing: border-box; }
body { font-family: -apple-system, system-ui, sans-serif; margin: 0; color: #222; background: #f7f7f8; }
.topnav { display: flex; justify-content: space-between; align-items: center; padding: 0.75rem 1.5rem; background: #fff; border-bottom: 1px solid #eee; }
.topnav nav a, .topnav nav button.link { margin-left: 1rem; color: #444; text-decoration: none; background: none; border: none; cursor: pointer; font: inherit; }
.brand { font-weight: 700; color: #c69214; text-decoration: none; }
.container { max-width: 1100px; margin: 1.5rem auto; padding: 0 1.5rem; }
.flash { padding: 0.75rem 1rem; border-radius: 4px; margin: 1rem 1.5rem; }
.flash.error { background: #fdecea; color: #b71c1c; }
.flash.success { background: #e8f5e9; color: #2e7d32; }
form label { display: block; margin: 0.5rem 0 0.25rem; font-size: 0.9rem; }
form input, form textarea, form select { width: 100%; padding: 0.5rem; border: 1px solid #ccc; border-radius: 4px; font: inherit; }
button.primary { padding: 0.6rem 1rem; background: #c69214; color: #fff; border: none; border-radius: 4px; cursor: pointer; }
table { width: 100%; border-collapse: collapse; background: #fff; }
th, td { padding: 0.6rem 0.8rem; border-bottom: 1px solid #eee; text-align: left; }
th { background: #fafafa; font-weight: 600; }
.danger { color: #b71c1c; }
```

`public/logo.png` — for now place any small placeholder PNG. The real Aquester logo can be dropped in later without code changes.

```bash
# placeholder so static-asset serving works; replace with the real logo file later
printf '\x89PNG\r\n\x1a\n' > public/logo.png
```

- [ ] **Step 3: Smoke-test it boots**

```bash
npm run start:dev
```

Visit `http://localhost:3000/`. The default `AppController` returns "Hello World!" — that's expected; we'll wire up real routes next. Stop with Ctrl+C.

- [ ] **Step 4: Commit**

```bash
git add src/main.ts views/ public/
git commit -m "feat(view): wire hbs view engine, layout, partials, and base styles"
```

---

### Task 1.10: bcrypt helper + tests

**Files:**
- Create: `src/auth/bcrypt.helper.ts`, `src/auth/bcrypt.helper.spec.ts`

- [ ] **Step 1: Write failing test**

`src/auth/bcrypt.helper.spec.ts`:

```typescript
import { hashPassword, verifyPassword } from './bcrypt.helper';

describe('bcrypt helper', () => {
  it('hashes and verifies a password', async () => {
    const hash = await hashPassword('s3cret');
    expect(hash).not.toEqual('s3cret');
    expect(await verifyPassword('s3cret', hash)).toBe(true);
    expect(await verifyPassword('wrong', hash)).toBe(false);
  });
});
```

- [ ] **Step 2: Run, expect fail**

```bash
npx jest src/auth/bcrypt.helper.spec.ts
```

Expected: FAIL ("Cannot find module './bcrypt.helper'").

- [ ] **Step 3: Implement**

`src/auth/bcrypt.helper.ts`:

```typescript
import * as bcrypt from 'bcrypt';

const ROUNDS = 10;

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, ROUNDS);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
```

- [ ] **Step 4: Run, expect pass**

```bash
npx jest src/auth/bcrypt.helper.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/auth/bcrypt.helper.ts src/auth/bcrypt.helper.spec.ts
git commit -m "feat(auth): add bcrypt password helper with tests"
```

---

### Task 1.11: Auth module — JWT strategy, login/logout, guards

**Files:**
- Create: `src/auth/auth.module.ts`, `src/auth/auth.controller.ts`, `src/auth/auth.service.ts`, `src/auth/jwt.strategy.ts`, `src/auth/dto/login.dto.ts`, `src/common/decorators/public.decorator.ts`, `src/common/decorators/roles.decorator.ts`, `src/common/decorators/current-user.decorator.ts`, `src/common/guards/jwt-auth.guard.ts`, `src/common/guards/roles.guard.ts`, `views/pages/login.hbs`
- Modify: `src/app.module.ts`, `src/app.controller.ts`

- [ ] **Step 1: Decorators**

`src/common/decorators/public.decorator.ts`:

```typescript
import { SetMetadata } from '@nestjs/common';
export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
```

`src/common/decorators/roles.decorator.ts`:

```typescript
import { SetMetadata } from '@nestjs/common';
import { UserRole } from '../../entities/user.entity';
export const ROLES_KEY = 'roles';
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
```

`src/common/decorators/current-user.decorator.ts`:

```typescript
import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface AuthUser { id: number; email: string; role: 'admin' | 'viewer' }

export const CurrentUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): AuthUser | undefined =>
    ctx.switchToHttp().getRequest().user,
);
```

- [ ] **Step 2: JWT strategy + guards**

`src/auth/jwt.strategy.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Request } from 'express';

const cookieExtractor = (req: Request): string | null =>
  req?.cookies?.['aq_token'] ?? null;

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([cookieExtractor]),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_SECRET'),
    });
  }

  async validate(payload: { sub: number; email: string; role: 'admin' | 'viewer' }) {
    return { id: payload.sub, email: payload.email, role: payload.role };
  }
}
```

`src/common/guards/jwt-auth.guard.ts`:

```typescript
import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { Response } from 'express';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) { super(); }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(), context.getClass(),
    ]);
    if (isPublic) return true;
    return super.canActivate(context);
  }

  handleRequest(err: any, user: any, _info: any, context: ExecutionContext) {
    if (err || !user) {
      const res: Response = context.switchToHttp().getResponse();
      res.redirect('/login');
      return null as any;
    }
    return user;
  }
}
```

`src/common/guards/roles.guard.ts`:

```typescript
import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { UserRole } from '../../entities/user.entity';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(), context.getClass(),
    ]);
    if (!required || required.length === 0) return true;
    const user = context.switchToHttp().getRequest().user;
    if (!user || !required.includes(user.role)) {
      throw new ForbiddenException('Admin access required');
    }
    return true;
  }
}
```

- [ ] **Step 3: Auth service, controller, DTO**

`src/auth/dto/login.dto.ts`:

```typescript
import { IsEmail, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @IsEmail() email!: string;
  @IsString() @MinLength(1) password!: string;
}
```

`src/auth/auth.service.ts`:

```typescript
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';
import { verifyPassword } from './bcrypt.helper';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly jwt: JwtService,
  ) {}

  async login(email: string, password: string): Promise<{ token: string; user: User }> {
    const user = await this.users.findOne({ where: { email } });
    if (!user) throw new UnauthorizedException('Invalid credentials');
    if (!(await verifyPassword(password, user.passwordHash))) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const token = await this.jwt.signAsync({ sub: user.id, email: user.email, role: user.role });
    return { token, user };
  }
}
```

`src/auth/auth.controller.ts`:

```typescript
import { Body, Controller, Get, Post, Render, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { Public } from '../common/decorators/public.decorator';

@Controller()
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public() @Get('login') @Render('pages/login')
  showLogin() {
    return { title: 'Login', layout: 'layouts/main' };
  }

  @Public() @Post('login')
  async doLogin(@Body() dto: LoginDto, @Res() res: Response) {
    try {
      const { token } = await this.auth.login(dto.email, dto.password);
      res.cookie('aq_token', token, {
        httpOnly: true,
        secure: process.env.COOKIE_SECURE === 'true',
        sameSite: 'lax',
      });
      return res.redirect('/');
    } catch {
      return res.render('pages/login', {
        title: 'Login', layout: 'layouts/main',
        error: 'Invalid email or password',
        email: dto.email,
      });
    }
  }

  @Post('logout')
  logout(@Res() res: Response, @Req() _req: Request) {
    res.clearCookie('aq_token');
    return res.redirect('/login');
  }
}
```

`src/auth/auth.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PassportModule } from '@nestjs/passport';
import { User } from '../entities/user.entity';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './jwt.strategy';

@Module({
  imports: [
    TypeOrmModule.forFeature([User]),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: config.get<string>('JWT_EXPIRES') },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
})
export class AuthModule {}
```

`views/pages/login.hbs`:

```handlebars
<h1>Login</h1>
{{#if error}}<div class="flash error">{{error}}</div>{{/if}}
<form method="post" action="/login" style="max-width:360px">
  <label>Email</label>
  <input type="email" name="email" value="{{email}}" required autofocus/>
  <label>Password</label>
  <input type="password" name="password" required/>
  <button type="submit" class="primary" style="margin-top:1rem">Sign in</button>
</form>
```

- [ ] **Step 4: Wire guards globally + register AuthModule**

Replace `src/app.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { validateEnv } from './config/env.validation';
import { buildTypeOrmOptions } from './config/typeorm.options';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => buildTypeOrmOptions(config),
    }),
    AuthModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
```

- [ ] **Step 5: Update `app.controller.ts` to render dashboard**

Replace `src/app.controller.ts`:

```typescript
import { Controller, Get, Render } from '@nestjs/common';
import { CurrentUser, AuthUser } from './common/decorators/current-user.decorator';

@Controller()
export class AppController {
  @Get() @Render('pages/dashboard')
  dashboard(@CurrentUser() user: AuthUser) {
    return {
      title: 'Dashboard',
      layout: 'layouts/main',
      user,
      isAdmin: user.role === 'admin',
    };
  }
}
```

Delete the auto-generated `app.controller.spec.ts` (it tests the old "Hello World" return value):

```bash
rm src/app.controller.spec.ts
```

- [ ] **Step 6: Manual verification**

```bash
npm run start:dev
```

Open `http://localhost:3000/` — should redirect to `/login`. Submit `kamal@aquester.com` / `changeme` — should land on `/`. Wrong password should re-render login with the error flash. Click Logout → redirected back to `/login`. Stop with Ctrl+C.

- [ ] **Step 7: Commit**

```bash
git add src/auth/ src/common/ src/app.module.ts src/app.controller.ts views/pages/login.hbs
git rm src/app.controller.spec.ts
git commit -m "feat(auth): JWT-in-cookie login, logout, role guards"
```

---

### Task 1.12: E2E test — auth flows

**Files:**
- Create: `test/e2e/test-helpers.ts`, `test/e2e/auth.e2e-spec.ts`
- Modify: `test/jest-e2e.json` if needed

- [ ] **Step 1: Test helpers (login, fetch admin/viewer cookies)**

`test/e2e/test-helpers.ts`:

```typescript
import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import * as cookieParser from 'cookie-parser';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';
import { hashPassword } from '../../src/auth/bcrypt.helper';
import { DataSource } from 'typeorm';

export async function bootstrapTestApp(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createApplicationContext
    ? (moduleRef.createNestApplication<NestExpressApplication>())
    : (moduleRef.createNestApplication<NestExpressApplication>());
  app.useStaticAssets(join(__dirname, '..', '..', 'public'), { prefix: '/public/' });
  app.setBaseViewsDir(join(__dirname, '..', '..', 'views'));
  app.setViewEngine('hbs');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const hbs = require('hbs');
  hbs.registerPartials(join(__dirname, '..', '..', 'views', 'partials'));
  app.use(cookieParser());
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
  await app.init();
  return app;
}

export async function ensureUser(app: INestApplication, email: string, password: string, role: 'admin' | 'viewer') {
  const ds = app.get(DataSource);
  await ds.query(`DELETE FROM users WHERE email = ?`, [email]);
  const hash = await hashPassword(password);
  await ds.query(`INSERT INTO users (email, password_hash, role) VALUES (?, ?, ?)`, [email, hash, role]);
}

export async function loginAndGetCookie(app: INestApplication, email: string, password: string): Promise<string> {
  const res = await request(app.getHttpServer())
    .post('/login')
    .send({ email, password })
    .expect(302);
  const setCookie = res.headers['set-cookie'];
  if (!setCookie) throw new Error('No Set-Cookie returned from /login');
  const arr = Array.isArray(setCookie) ? setCookie : [setCookie];
  const aq = arr.find((c: string) => c.startsWith('aq_token='));
  if (!aq) throw new Error('aq_token cookie missing');
  return aq.split(';')[0];
}
```

- [ ] **Step 2: Auth E2E test**

`test/e2e/auth.e2e-spec.ts`:

```typescript
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { bootstrapTestApp, ensureUser, loginAndGetCookie } from './test-helpers';

describe('Auth (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await bootstrapTestApp();
    await ensureUser(app, 'admin-e2e@aquester.com', 'pw-admin-1', 'admin');
    await ensureUser(app, 'viewer-e2e@aquester.com', 'pw-viewer-1', 'viewer');
  });

  afterAll(async () => { await app.close(); });

  it('redirects unauthenticated requests to /login', async () => {
    const res = await request(app.getHttpServer()).get('/').expect(302);
    expect(res.headers.location).toBe('/login');
  });

  it('rejects bad credentials with the login page + error', async () => {
    const res = await request(app.getHttpServer())
      .post('/login')
      .send({ email: 'admin-e2e@aquester.com', password: 'wrong' })
      .expect(200);
    expect(res.text).toContain('Invalid email or password');
  });

  it('logs in admin and renders dashboard', async () => {
    const cookie = await loginAndGetCookie(app, 'admin-e2e@aquester.com', 'pw-admin-1');
    const res = await request(app.getHttpServer())
      .get('/')
      .set('Cookie', cookie)
      .expect(200);
    expect(res.text).toContain('Dashboard');
    expect(res.text).toContain('admin-e2e@aquester.com');
  });

  it('logout clears the cookie', async () => {
    const cookie = await loginAndGetCookie(app, 'admin-e2e@aquester.com', 'pw-admin-1');
    const res = await request(app.getHttpServer())
      .post('/logout')
      .set('Cookie', cookie)
      .expect(302);
    expect(res.headers.location).toBe('/login');
    const cleared = ([] as string[]).concat(res.headers['set-cookie'] ?? []);
    expect(cleared.find((c) => c.startsWith('aq_token='))).toMatch(/aq_token=;/);
  });
});
```

- [ ] **Step 3: Confirm `test/jest-e2e.json` matches `*.e2e-spec.ts`**

Open `test/jest-e2e.json`. The default file produced by `nest new` already has `"testRegex": ".e2e-spec.ts$"` — leave it.

- [ ] **Step 4: Run E2E test**

```bash
npm run test:e2e
```

Expected: 4 tests pass.

If it fails because the test DB has stale `users` rows, the `ensureUser` helper already deletes/re-inserts the test users, so any failure points to a real bug.

- [ ] **Step 5: Commit**

```bash
git add test/e2e/
git commit -m "test(auth): e2e coverage for login redirect, bad creds, dashboard, logout"
```

---

### Task 1.13: Manual smoke check — Phase 1 done

- [ ] **Step 1: Push to GitHub**

```bash
git push -u origin master
```

- [ ] **Step 2: Verify**
  - `npm run start:dev` boots cleanly
  - `http://localhost:3000/` → redirect to `/login`
  - Login as `kamal@aquester.com` / `changeme` → dashboard renders
  - Logout → back at `/login`
  - `npm test && npm run test:e2e` → all green

If all five pass, Phase 1 is done. Onward to Phase 2.

---

# PHASE 2 — Settings & Customers

End state: admin can edit company settings (VAT rate, currency, from-block, bank, contact). Any logged-in user can browse customers; admin can create/edit them and manage their CC-email list.

---

### Task 2.1: Settings service + tests

**Files:**
- Create: `src/settings/settings.module.ts`, `src/settings/settings.service.ts`, `src/settings/settings.service.spec.ts`, `src/settings/dto/update-settings.dto.ts`
- Modify: `src/app.module.ts`

- [ ] **Step 1: DTO**

`src/settings/dto/update-settings.dto.ts`:

```typescript
import { IsNumberString, IsString, MaxLength, Min } from 'class-validator';
import { Transform } from 'class-transformer';

export class UpdateSettingsDto {
  @IsNumberString() vatRate!: string;
  @IsString() @MaxLength(32) currencyLabel!: string;

  @IsString() @MaxLength(255) fromCompanyName!: string;
  @IsString() fromAddress!: string;
  @IsString() @MaxLength(64) fromPan!: string;
  @IsString() @MaxLength(255) fromEmail!: string;

  @IsString() bankDetails!: string;

  @IsString() @MaxLength(255) contactName!: string;
  @IsString() @MaxLength(255) contactEmail!: string;
  @IsString() @MaxLength(64) contactPhone!: string;
}
```

- [ ] **Step 2: Failing test**

`src/settings/settings.service.spec.ts`:

```typescript
import { Test } from '@nestjs/testing';
import { TypeOrmModule, getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Settings } from '../entities/settings.entity';
import { SettingsService } from './settings.service';

describe('SettingsService (unit)', () => {
  it('returns the seeded row from get()', async () => {
    const fakeRepo = { findOne: jest.fn().mockResolvedValue({ id: 1, vatRate: '13.00' }) } as unknown as Repository<Settings>;
    const svc = new SettingsService(fakeRepo);
    const result = await svc.get();
    expect(result.vatRate).toBe('13.00');
  });

  it('updates and returns the row from update()', async () => {
    const row = { id: 1, vatRate: '13.00' } as Settings;
    const fakeRepo = {
      findOne: jest.fn().mockResolvedValue(row),
      save: jest.fn().mockImplementation(async (s: Settings) => s),
    } as unknown as Repository<Settings>;
    const svc = new SettingsService(fakeRepo);
    const result = await svc.update({ vatRate: '15.00' } as any);
    expect(result.vatRate).toBe('15.00');
    expect(fakeRepo.save).toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Run, expect fail**

```bash
npx jest src/settings/settings.service.spec.ts
```

Expected: FAIL ("Cannot find module './settings.service'").

- [ ] **Step 4: Implement service**

`src/settings/settings.service.ts`:

```typescript
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Settings } from '../entities/settings.entity';
import { UpdateSettingsDto } from './dto/update-settings.dto';

@Injectable()
export class SettingsService {
  constructor(@InjectRepository(Settings) private readonly repo: Repository<Settings>) {}

  async get(): Promise<Settings> {
    const row = await this.repo.findOne({ where: { id: 1 } });
    if (!row) throw new NotFoundException('Settings row missing — re-run migrations');
    return row;
  }

  async update(dto: UpdateSettingsDto): Promise<Settings> {
    const row = await this.get();
    Object.assign(row, dto);
    return this.repo.save(row);
  }
}
```

- [ ] **Step 5: Module**

`src/settings/settings.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Settings } from '../entities/settings.entity';
import { SettingsService } from './settings.service';

@Module({
  imports: [TypeOrmModule.forFeature([Settings])],
  providers: [SettingsService],
  exports: [SettingsService],
})
export class SettingsModule {}
```

Add `SettingsModule` to `src/app.module.ts` `imports: [...]`.

- [ ] **Step 6: Run, expect pass**

```bash
npx jest src/settings/settings.service.spec.ts
```

Expected: 2 PASS.

- [ ] **Step 7: Commit**

```bash
git add src/settings/ src/app.module.ts
git commit -m "feat(settings): SettingsService get/update with unit tests"
```

---

### Task 2.2: Settings page (admin only)

**Files:**
- Create: `src/settings/settings.controller.ts`, `views/pages/settings/form.hbs`
- Modify: `src/settings/settings.module.ts`

- [ ] **Step 1: Controller**

`src/settings/settings.controller.ts`:

```typescript
import { Body, Controller, Get, Post, Render, Res } from '@nestjs/common';
import { Response } from 'express';
import { SettingsService } from './settings.service';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';

@Controller('settings')
@Roles('admin')
export class SettingsController {
  constructor(private readonly svc: SettingsService) {}

  @Get() @Render('pages/settings/form')
  async showForm(@CurrentUser() user: AuthUser) {
    const settings = await this.svc.get();
    return { title: 'Settings', layout: 'layouts/main', user, isAdmin: true, settings };
  }

  @Post()
  async save(@Body() dto: UpdateSettingsDto, @Res() res: Response) {
    await this.svc.update(dto);
    return res.redirect('/settings');
  }
}
```

Add `controllers: [SettingsController]` to `SettingsModule` and import the controller at the top.

- [ ] **Step 2: View**

`views/pages/settings/form.hbs`:

```handlebars
<h1>Settings</h1>
<form method="post" action="/settings" style="max-width:640px">
  <h2>Tax & currency</h2>
  <label>VAT rate (%)</label>
  <input name="vatRate" value="{{settings.vatRate}}" required/>
  <label>Currency label</label>
  <input name="currencyLabel" value="{{settings.currencyLabel}}" required/>

  <h2>From-company block</h2>
  <label>Company name</label>
  <input name="fromCompanyName" value="{{settings.fromCompanyName}}" required/>
  <label>Address</label>
  <textarea name="fromAddress" rows="3" required>{{settings.fromAddress}}</textarea>
  <label>PAN no.</label>
  <input name="fromPan" value="{{settings.fromPan}}" required/>
  <label>Email</label>
  <input name="fromEmail" value="{{settings.fromEmail}}" required/>

  <h2>Bank details</h2>
  <textarea name="bankDetails" rows="3" required>{{settings.bankDetails}}</textarea>

  <h2>Contact person</h2>
  <label>Name</label>
  <input name="contactName" value="{{settings.contactName}}" required/>
  <label>Email</label>
  <input name="contactEmail" value="{{settings.contactEmail}}" required/>
  <label>Phone</label>
  <input name="contactPhone" value="{{settings.contactPhone}}" required/>

  <button type="submit" class="primary" style="margin-top:1rem">Save</button>
</form>
```

- [ ] **Step 3: Manual verify**

```bash
npm run start:dev
```

Login as admin → `/settings` renders with current values → change VAT to `13.50` → submit → page reloads with the new value → check `mysql` shows `vat_rate = 13.50`. Reset to `13.00` and save again. Stop server.

- [ ] **Step 4: Commit**

```bash
git add src/settings/ views/pages/settings/
git commit -m "feat(settings): admin settings page (GET/POST /settings)"
```

---

### Task 2.3: Customers service + tests

**Files:**
- Create: `src/customers/customers.module.ts`, `src/customers/customers.service.ts`, `src/customers/customers.service.spec.ts`, `src/customers/dto/customer.dto.ts`

- [ ] **Step 1: DTO**

`src/customers/dto/customer.dto.ts`:

```typescript
import { Transform, Type } from 'class-transformer';
import { ArrayUnique, IsArray, IsEmail, IsOptional, IsString, MaxLength } from 'class-validator';

export class CustomerDto {
  @IsString() @MaxLength(255) companyName!: string;
  @IsOptional() @IsString() @MaxLength(64) registrationNumber?: string;
  @IsString() address!: string;
  @IsEmail() primaryEmail!: string;
  @IsOptional() @IsString() @MaxLength(64) phone?: string;
  @IsOptional() @IsString() notes?: string;

  // Form posts CCs as a textarea (one email per line). We coerce → array → validate.
  @Transform(({ value }) => {
    if (Array.isArray(value)) return value;
    if (typeof value !== 'string') return [];
    return value.split(/[\n,]/).map((e) => e.trim()).filter(Boolean);
  })
  @IsArray() @ArrayUnique() @IsEmail({}, { each: true })
  ccEmails!: string[];
}
```

- [ ] **Step 2: Failing test**

`src/customers/customers.service.spec.ts`:

```typescript
import { Test } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CustomersService } from './customers.service';
import { CustomersModule } from './customers.module';
import { Customer } from '../entities/customer.entity';
import { CustomerCcEmail } from '../entities/customer-cc-email.entity';
import { buildTypeOrmOptions } from '../config/typeorm.options';
import { validateEnv } from '../config/env.validation';
import { DataSource } from 'typeorm';

describe('CustomersService (integration)', () => {
  let svc: CustomersService;
  let ds: DataSource;

  beforeAll(async () => {
    const mod = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
        TypeOrmModule.forRootAsync({
          inject: [ConfigService],
          useFactory: (config: ConfigService) => buildTypeOrmOptions(config),
        }),
        CustomersModule,
      ],
    }).compile();
    svc = mod.get(CustomersService);
    ds = mod.get(DataSource);
    await ds.query('DELETE FROM customer_cc_emails');
    await ds.query('DELETE FROM customers');
  });

  afterAll(async () => { await ds.destroy(); });

  it('creates a customer with CC emails', async () => {
    const c = await svc.create({
      companyName: 'Kaju Art Rugs Pvt. Ltd.',
      registrationNumber: '111',
      address: 'Bauddha, Kathmandu, Nepal',
      primaryEmail: 'rugs@example.com',
      phone: '9800000000',
      notes: '',
      ccEmails: ['ops@example.com', 'finance@example.com'],
    });
    expect(c.id).toBeGreaterThan(0);

    const found = await svc.findOne(c.id);
    expect(found.ccEmails.map((e) => e.email).sort()).toEqual(['finance@example.com', 'ops@example.com']);
  });

  it('replaces CC emails on update', async () => {
    const created = await svc.create({
      companyName: 'X', address: 'addr', primaryEmail: 'x@example.com',
      ccEmails: ['a@example.com'], registrationNumber: undefined, phone: undefined, notes: undefined,
    });
    await svc.update(created.id, {
      companyName: 'X', address: 'addr', primaryEmail: 'x@example.com',
      ccEmails: ['b@example.com', 'c@example.com'],
      registrationNumber: undefined, phone: undefined, notes: undefined,
    });
    const after = await svc.findOne(created.id);
    expect(after.ccEmails.map((e) => e.email).sort()).toEqual(['b@example.com', 'c@example.com']);
  });
});
```

- [ ] **Step 3: Run, expect fail**

```bash
npx jest src/customers/customers.service.spec.ts
```

Expected: FAIL ("Cannot find module …").

- [ ] **Step 4: Implement service + module**

`src/customers/customers.service.ts`:

```typescript
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, ILike, Repository } from 'typeorm';
import { Customer } from '../entities/customer.entity';
import { CustomerCcEmail } from '../entities/customer-cc-email.entity';
import { CustomerDto } from './dto/customer.dto';

@Injectable()
export class CustomersService {
  constructor(
    @InjectRepository(Customer) private readonly customers: Repository<Customer>,
    @InjectRepository(CustomerCcEmail) private readonly ccEmails: Repository<CustomerCcEmail>,
    @InjectDataSource() private readonly ds: DataSource,
  ) {}

  list(search?: string) {
    return this.customers.find({
      where: search ? { companyName: ILike(`%${search}%`) } : {},
      order: { companyName: 'ASC' },
    });
  }

  async findOne(id: number): Promise<Customer> {
    const c = await this.customers.findOne({ where: { id }, relations: ['ccEmails'] });
    if (!c) throw new NotFoundException(`Customer ${id} not found`);
    return c;
  }

  create(dto: CustomerDto): Promise<Customer> {
    return this.ds.transaction(async (tx) => {
      const customer = await tx.getRepository(Customer).save(tx.getRepository(Customer).create({
        companyName: dto.companyName,
        registrationNumber: dto.registrationNumber,
        address: dto.address,
        primaryEmail: dto.primaryEmail,
        phone: dto.phone,
        notes: dto.notes,
      }));
      await tx.getRepository(CustomerCcEmail).save(
        dto.ccEmails.map((email) => ({ customerId: customer.id, email })),
      );
      return tx.getRepository(Customer).findOneOrFail({ where: { id: customer.id }, relations: ['ccEmails'] });
    });
  }

  async update(id: number, dto: CustomerDto): Promise<Customer> {
    return this.ds.transaction(async (tx) => {
      const repo = tx.getRepository(Customer);
      const ccRepo = tx.getRepository(CustomerCcEmail);
      const customer = await repo.findOne({ where: { id } });
      if (!customer) throw new NotFoundException(`Customer ${id} not found`);
      Object.assign(customer, {
        companyName: dto.companyName,
        registrationNumber: dto.registrationNumber,
        address: dto.address,
        primaryEmail: dto.primaryEmail,
        phone: dto.phone,
        notes: dto.notes,
      });
      await repo.save(customer);
      await ccRepo.delete({ customerId: id });
      if (dto.ccEmails.length > 0) {
        await ccRepo.save(dto.ccEmails.map((email) => ({ customerId: id, email })));
      }
      return repo.findOneOrFail({ where: { id }, relations: ['ccEmails'] });
    });
  }
}
```

`src/customers/customers.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Customer } from '../entities/customer.entity';
import { CustomerCcEmail } from '../entities/customer-cc-email.entity';
import { CustomersService } from './customers.service';

@Module({
  imports: [TypeOrmModule.forFeature([Customer, CustomerCcEmail])],
  providers: [CustomersService],
  exports: [CustomersService],
})
export class CustomersModule {}
```

Add `CustomersModule` to `src/app.module.ts` `imports`.

- [ ] **Step 5: Run, expect pass**

```bash
npx jest src/customers/customers.service.spec.ts
```

Expected: 2 PASS.

- [ ] **Step 6: Commit**

```bash
git add src/customers/ src/app.module.ts
git commit -m "feat(customers): CustomersService with create/update/list and CC emails"
```

---

### Task 2.4: Customers controller + views

**Files:**
- Create: `src/customers/customers.controller.ts`, `views/pages/customers/{list,form,detail}.hbs`
- Modify: `src/customers/customers.module.ts`

- [ ] **Step 1: Controller**

`src/customers/customers.controller.ts`:

```typescript
import { Body, Controller, Get, Param, ParseIntPipe, Post, Query, Render, Res } from '@nestjs/common';
import { Response } from 'express';
import { CustomersService } from './customers.service';
import { CustomerDto } from './dto/customer.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';

@Controller('customers')
export class CustomersController {
  constructor(private readonly svc: CustomersService) {}

  @Get() @Render('pages/customers/list')
  async list(@CurrentUser() user: AuthUser, @Query('q') q?: string) {
    const customers = await this.svc.list(q);
    return { title: 'Customers', layout: 'layouts/main', user, isAdmin: user.role === 'admin', customers, q: q ?? '' };
  }

  @Roles('admin') @Get('new') @Render('pages/customers/form')
  newForm(@CurrentUser() user: AuthUser) {
    return {
      title: 'New customer', layout: 'layouts/main', user, isAdmin: true,
      action: '/customers/new', customer: { ccEmails: [] }, ccEmailsText: '',
    };
  }

  @Roles('admin') @Post('new')
  async createSubmit(@Body() dto: CustomerDto, @Res() res: Response) {
    const created = await this.svc.create(dto);
    return res.redirect(`/customers/${created.id}`);
  }

  @Get(':id') @Render('pages/customers/detail')
  async detail(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthUser) {
    const customer = await this.svc.findOne(id);
    return { title: customer.companyName, layout: 'layouts/main', user, isAdmin: user.role === 'admin', customer };
  }

  @Roles('admin') @Get(':id/edit') @Render('pages/customers/form')
  async editForm(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthUser) {
    const customer = await this.svc.findOne(id);
    return {
      title: `Edit ${customer.companyName}`, layout: 'layouts/main', user, isAdmin: true,
      action: `/customers/${id}/edit`, customer, ccEmailsText: customer.ccEmails.map((e) => e.email).join('\n'),
    };
  }

  @Roles('admin') @Post(':id/edit')
  async editSubmit(@Param('id', ParseIntPipe) id: number, @Body() dto: CustomerDto, @Res() res: Response) {
    await this.svc.update(id, dto);
    return res.redirect(`/customers/${id}`);
  }
}
```

Add `controllers: [CustomersController]` to `CustomersModule`.

- [ ] **Step 2: List view**

`views/pages/customers/list.hbs`:

```handlebars
<div style="display:flex; justify-content:space-between; align-items:center;">
  <h1>Customers</h1>
  {{#if isAdmin}}<a href="/customers/new" class="primary" style="padding:0.5rem 0.9rem; background:#c69214; color:#fff; border-radius:4px; text-decoration:none;">+ New customer</a>{{/if}}
</div>
<form method="get" action="/customers" style="max-width:360px; margin-bottom:1rem">
  <input name="q" value="{{q}}" placeholder="Search by company name"/>
</form>
<table>
  <thead><tr><th>Company</th><th>Email</th><th>Phone</th><th></th></tr></thead>
  <tbody>
    {{#each customers}}
      <tr>
        <td><a href="/customers/{{this.id}}">{{this.companyName}}</a></td>
        <td>{{this.primaryEmail}}</td>
        <td>{{this.phone}}</td>
        <td><a href="/invoices/new?customerId={{this.id}}">Create invoice</a></td>
      </tr>
    {{else}}
      <tr><td colspan="4">No customers yet.</td></tr>
    {{/each}}
  </tbody>
</table>
```

- [ ] **Step 3: Form view (used by both new and edit)**

`views/pages/customers/form.hbs`:

```handlebars
<h1>{{title}}</h1>
<form method="post" action="{{action}}" style="max-width:640px">
  <label>Company name</label>
  <input name="companyName" value="{{customer.companyName}}" required/>
  <label>Registration / PAN number</label>
  <input name="registrationNumber" value="{{customer.registrationNumber}}"/>
  <label>Address</label>
  <textarea name="address" rows="3" required>{{customer.address}}</textarea>
  <label>Primary email</label>
  <input type="email" name="primaryEmail" value="{{customer.primaryEmail}}" required/>
  <label>Phone</label>
  <input name="phone" value="{{customer.phone}}"/>
  <label>CC emails (one per line)</label>
  <textarea name="ccEmails" rows="3">{{ccEmailsText}}</textarea>
  <label>Internal notes</label>
  <textarea name="notes" rows="3">{{customer.notes}}</textarea>
  <button type="submit" class="primary" style="margin-top:1rem">Save</button>
</form>
```

- [ ] **Step 4: Detail view**

`views/pages/customers/detail.hbs`:

```handlebars
<div style="display:flex; justify-content:space-between; align-items:center;">
  <h1>{{customer.companyName}}</h1>
  <div>
    {{#if isAdmin}}
      <a href="/invoices/new?customerId={{customer.id}}" class="primary" style="padding:0.5rem 0.9rem; background:#c69214; color:#fff; border-radius:4px; text-decoration:none;">+ Create invoice</a>
      <a href="/customers/{{customer.id}}/edit" style="margin-left:0.75rem">Edit</a>
    {{/if}}
  </div>
</div>
<dl>
  <dt>Address</dt><dd>{{customer.address}}</dd>
  <dt>Registration / PAN</dt><dd>{{customer.registrationNumber}}</dd>
  <dt>Primary email</dt><dd>{{customer.primaryEmail}}</dd>
  <dt>CC emails</dt><dd>{{#each customer.ccEmails}}{{this.email}}<br>{{/each}}</dd>
  <dt>Phone</dt><dd>{{customer.phone}}</dd>
  <dt>Notes</dt><dd>{{customer.notes}}</dd>
</dl>
```

- [ ] **Step 5: Manual verify**

```bash
npm run start:dev
```

Login as admin → `/customers` empty list → click "+ New customer" → fill in Kaju Art Rugs (with two CC emails) → save → land on detail page → click Edit → change one CC email → save → confirm. Stop server.

- [ ] **Step 6: Commit**

```bash
git add src/customers/customers.controller.ts src/customers/customers.module.ts views/pages/customers/
git commit -m "feat(customers): list/create/edit/detail pages with role guards"
```

---

### Task 2.5: E2E test — customer CRUD + role enforcement

**Files:**
- Create: `test/e2e/customers.e2e-spec.ts`

- [ ] **Step 1: Test**

`test/e2e/customers.e2e-spec.ts`:

```typescript
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { DataSource } from 'typeorm';
import { bootstrapTestApp, ensureUser, loginAndGetCookie } from './test-helpers';

describe('Customers (e2e)', () => {
  let app: INestApplication;
  let adminCookie: string;
  let viewerCookie: string;

  beforeAll(async () => {
    app = await bootstrapTestApp();
    await ensureUser(app, 'admin-cust@aquester.com', 'pw1', 'admin');
    await ensureUser(app, 'viewer-cust@aquester.com', 'pw1', 'viewer');
    adminCookie = await loginAndGetCookie(app, 'admin-cust@aquester.com', 'pw1');
    viewerCookie = await loginAndGetCookie(app, 'viewer-cust@aquester.com', 'pw1');
    const ds = app.get(DataSource);
    await ds.query('DELETE FROM customer_cc_emails');
    await ds.query('DELETE FROM customers');
  });

  afterAll(async () => { await app.close(); });

  it('admin can create + view + edit a customer', async () => {
    await request(app.getHttpServer())
      .post('/customers/new')
      .set('Cookie', adminCookie)
      .send({
        companyName: 'Acme', registrationNumber: '999',
        address: 'Kathmandu', primaryEmail: 'acme@example.com',
        ccEmails: 'a@example.com\nb@example.com',
      })
      .expect(302);

    const list = await request(app.getHttpServer())
      .get('/customers')
      .set('Cookie', adminCookie).expect(200);
    expect(list.text).toContain('Acme');

    const ds = app.get(DataSource);
    const [row] = await ds.query(`SELECT id FROM customers WHERE company_name='Acme'`);
    const detail = await request(app.getHttpServer())
      .get(`/customers/${row.id}`).set('Cookie', adminCookie).expect(200);
    expect(detail.text).toContain('a@example.com');
    expect(detail.text).toContain('b@example.com');

    await request(app.getHttpServer())
      .post(`/customers/${row.id}/edit`).set('Cookie', adminCookie)
      .send({
        companyName: 'Acme Co.', registrationNumber: '999',
        address: 'Kathmandu', primaryEmail: 'acme@example.com',
        ccEmails: 'c@example.com',
      }).expect(302);
    const after = await request(app.getHttpServer())
      .get(`/customers/${row.id}`).set('Cookie', adminCookie).expect(200);
    expect(after.text).toContain('Acme Co.');
    expect(after.text).toContain('c@example.com');
    expect(after.text).not.toContain('a@example.com');
  });

  it('viewer cannot open new-customer page', async () => {
    await request(app.getHttpServer())
      .get('/customers/new').set('Cookie', viewerCookie).expect(403);
  });

  it('viewer cannot post to /customers/new', async () => {
    await request(app.getHttpServer())
      .post('/customers/new').set('Cookie', viewerCookie)
      .send({ companyName: 'x', address: 'y', primaryEmail: 'x@y.com', ccEmails: '' })
      .expect(403);
  });

  it('viewer can view the customer list', async () => {
    const res = await request(app.getHttpServer())
      .get('/customers').set('Cookie', viewerCookie).expect(200);
    expect(res.text).toContain('Customers');
  });
});
```

- [ ] **Step 2: Run, expect pass**

```bash
npm run test:e2e -- customers
```

Expected: 4 PASS.

The 403 responses depend on a global exception filter mapping `ForbiddenException` → 403 (default behaviour). If the response is 500 instead of 403, check that `RolesGuard` is registered as a global guard in `AppModule`.

- [ ] **Step 3: Commit**

```bash
git add test/e2e/customers.e2e-spec.ts
git commit -m "test(customers): e2e for CRUD and viewer role enforcement"
```

---

### Task 2.6: Manual smoke check — Phase 2 done

- [ ] **Step 1: Push**

```bash
git push
```

- [ ] **Step 2: Verify**
  - `npm run start:dev` boots
  - Admin can edit `/settings`
  - Admin can create / view / edit a customer with CC emails
  - Viewer logged in can browse `/customers` but the "+ New customer" link doesn't show; visiting `/customers/new` returns 403
  - `npm test && npm run test:e2e` all green

Phase 2 done.

---

# PHASE 3 — Invoices & PDF

End state: admin can create and view an invoice, the PDF generates correctly with the Aquester layout, and the invoice number counter works (with a manual reset). Edit/email comes in Phase 4.

---

### Task 3.1: Money helpers + tests

**Files:**
- Create: `src/common/helpers/money.ts`, `src/common/helpers/money.spec.ts`

- [ ] **Step 1: Failing test**

`src/common/helpers/money.spec.ts`:

```typescript
import { computeLineTotal, computeTotals, money } from './money';

describe('money helpers', () => {
  it('rounds money to 2dp half-up', () => {
    expect(money(1.005)).toBe('1.01');
    expect(money(1.004)).toBe('1.00');
    expect(money(0)).toBe('0.00');
  });

  it('computes line total = unit_cost * quantity', () => {
    expect(computeLineTotal('1600.00', '24')).toBe('38400.00');
    expect(computeLineTotal('1000.00', '3')).toBe('3000.00');
    expect(computeLineTotal('99.99', '3')).toBe('299.97');
  });

  it('computes subtotal/vat/grand total for a multi-line invoice', () => {
    const totals = computeTotals(
      [
        { unitCost: '1600.00', quantity: '24' }, // 38,400.00
        { unitCost: '1000.00', quantity: '3' },  // 3,000.00
      ],
      '13.00',
    );
    expect(totals.subtotal).toBe('41400.00');
    expect(totals.vatAmount).toBe('5382.00');
    expect(totals.grandTotal).toBe('46782.00');
  });
});
```

- [ ] **Step 2: Run, expect fail**

```bash
npx jest src/common/helpers/money.spec.ts
```

Expected: FAIL ("Cannot find module './money'").

- [ ] **Step 3: Implement**

`src/common/helpers/money.ts`:

```typescript
export function money(n: number): string {
  // half-up rounding to 2dp
  const cents = Math.round((n + Number.EPSILON) * 100);
  return (cents / 100).toFixed(2);
}

export function computeLineTotal(unitCost: string, quantity: string): string {
  return money(Number(unitCost) * Number(quantity));
}

export interface ItemLike { unitCost: string; quantity: string }

export function computeTotals(items: ItemLike[], vatRate: string) {
  const subtotalNum = items.reduce(
    (acc, it) => acc + Number(it.unitCost) * Number(it.quantity),
    0,
  );
  const subtotal = money(subtotalNum);
  const vatAmount = money(subtotalNum * (Number(vatRate) / 100));
  const grandTotal = money(Number(subtotal) + Number(vatAmount));
  return { subtotal, vatAmount, grandTotal };
}
```

- [ ] **Step 4: Run, expect pass**

```bash
npx jest src/common/helpers/money.spec.ts
```

Expected: 3 PASS.

- [ ] **Step 5: Commit**

```bash
git add src/common/helpers/money.ts src/common/helpers/money.spec.ts
git commit -m "feat(helpers): money math (line total, subtotal, vat, grand total)"
```

---

### Task 3.2: Amount-in-words helper + tests

**Files:**
- Create: `src/common/helpers/amount-in-words.ts`, `src/common/helpers/amount-in-words.spec.ts`

- [ ] **Step 1: Failing test**

`src/common/helpers/amount-in-words.spec.ts`:

```typescript
import { amountInWords } from './amount-in-words';

describe('amountInWords', () => {
  it('handles a typical invoice total', () => {
    expect(amountInWords('46782.00', 'rupees'))
      .toBe('Forty-six thousand seven hundred eighty-two rupees only.');
  });

  it('handles zero', () => {
    expect(amountInWords('0.00', 'rupees')).toBe('Zero rupees only.');
  });

  it('handles decimals (paisa)', () => {
    expect(amountInWords('100.50', 'rupees'))
      .toBe('One hundred rupees and fifty paisa only.');
  });

  it('uses the configured currency label', () => {
    expect(amountInWords('5.00', 'dollars')).toBe('Five dollars only.');
  });
});
```

- [ ] **Step 2: Run, expect fail**

```bash
npx jest src/common/helpers/amount-in-words.spec.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement**

`src/common/helpers/amount-in-words.ts`:

```typescript
import { toWords } from 'number-to-words';

function cap(s: string): string { return s.charAt(0).toUpperCase() + s.slice(1); }

export function amountInWords(value: string, currencyLabel: string): string {
  const n = Number(value);
  const whole = Math.floor(n);
  const cents = Math.round((n - whole) * 100);
  const wholeWords = cap(toWords(whole));
  if (cents === 0) {
    return `${wholeWords} ${currencyLabel} only.`;
  }
  return `${wholeWords} ${currencyLabel} and ${toWords(cents)} paisa only.`;
}
```

- [ ] **Step 4: Run, expect pass**

```bash
npx jest src/common/helpers/amount-in-words.spec.ts
```

Expected: 4 PASS.

- [ ] **Step 5: Commit**

```bash
git add src/common/helpers/amount-in-words.ts src/common/helpers/amount-in-words.spec.ts
git commit -m "feat(helpers): amount-in-words with currency suffix"
```

---

### Task 3.3: Date format helper + tests

**Files:**
- Create: `src/common/helpers/date-format.ts`, `src/common/helpers/date-format.spec.ts`

- [ ] **Step 1: Failing test**

`src/common/helpers/date-format.spec.ts`:

```typescript
import { formatInvoiceDate } from './date-format';

describe('formatInvoiceDate', () => {
  it('formats with the day-ordinal suffix', () => {
    expect(formatInvoiceDate('2025-09-22')).toBe('22nd Sep 2025');
    expect(formatInvoiceDate('2025-01-01')).toBe('1st Jan 2025');
    expect(formatInvoiceDate('2025-03-03')).toBe('3rd Mar 2025');
    expect(formatInvoiceDate('2025-04-04')).toBe('4th Apr 2025');
    expect(formatInvoiceDate('2025-04-11')).toBe('11th Apr 2025');
    expect(formatInvoiceDate('2025-04-21')).toBe('21st Apr 2025');
  });
});
```

- [ ] **Step 2: Run, expect fail**

```bash
npx jest src/common/helpers/date-format.spec.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement**

`src/common/helpers/date-format.ts`:

```typescript
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function ordinal(d: number): string {
  if (d >= 11 && d <= 13) return `${d}th`;
  switch (d % 10) {
    case 1: return `${d}st`;
    case 2: return `${d}nd`;
    case 3: return `${d}rd`;
    default: return `${d}th`;
  }
}

export function formatInvoiceDate(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  return `${ordinal(d)} ${MONTHS[m - 1]} ${y}`;
}
```

- [ ] **Step 4: Run, expect pass**

```bash
npx jest src/common/helpers/date-format.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/common/helpers/date-format.ts src/common/helpers/date-format.spec.ts
git commit -m "feat(helpers): formatInvoiceDate with ordinal suffix"
```

---

### Task 3.4: Counters service (claim-next, get-current, reset)

**Files:**
- Create: `src/counters/counters.module.ts`, `src/counters/counters.service.ts`, `src/counters/counters.service.spec.ts`
- Modify: `src/app.module.ts`

- [ ] **Step 1: Failing test**

`src/counters/counters.service.spec.ts`:

```typescript
import { Test } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { CountersModule } from './counters.module';
import { CountersService } from './counters.service';
import { buildTypeOrmOptions } from '../config/typeorm.options';
import { validateEnv } from '../config/env.validation';

describe('CountersService (integration)', () => {
  let svc: CountersService;
  let ds: DataSource;
  const YEAR = 9999; // unused year for isolation

  beforeAll(async () => {
    const mod = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
        TypeOrmModule.forRootAsync({
          inject: [ConfigService],
          useFactory: (config: ConfigService) => buildTypeOrmOptions(config),
        }),
        CountersModule,
      ],
    }).compile();
    svc = mod.get(CountersService);
    ds = mod.get(DataSource);
    await ds.query('DELETE FROM invoice_counters WHERE year = ?', [YEAR]);
  });

  afterAll(async () => { await ds.destroy(); });

  it('claimNext returns 1 for a fresh year, then 2, then 3', async () => {
    const a = await svc.claimNext(YEAR); expect(a).toBe(1);
    const b = await svc.claimNext(YEAR); expect(b).toBe(2);
    const c = await svc.claimNext(YEAR); expect(c).toBe(3);
  });

  it('getCurrent returns the last claimed number', async () => {
    expect(await svc.getCurrent(YEAR)).toBe(3);
  });

  it('reset rolls last_number back to 0', async () => {
    await svc.reset(YEAR);
    expect(await svc.getCurrent(YEAR)).toBe(0);
    expect(await svc.claimNext(YEAR)).toBe(1);
  });
});
```

- [ ] **Step 2: Run, expect fail**

```bash
npx jest src/counters/counters.service.spec.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement service + module**

`src/counters/counters.service.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { InvoiceCounter } from '../entities/invoice-counter.entity';

@Injectable()
export class CountersService {
  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  /** Atomic: read-with-lock, insert if missing, increment, return claimed number. */
  claimNext(year: number, manager?: EntityManager): Promise<number> {
    const run = async (mgr: EntityManager) => {
      const repo = mgr.getRepository(InvoiceCounter);
      let row = await repo
        .createQueryBuilder('c')
        .setLock('pessimistic_write')
        .where('c.year = :year', { year })
        .getOne();
      if (!row) {
        await repo.insert({ year, lastNumber: 0 });
        row = await repo
          .createQueryBuilder('c')
          .setLock('pessimistic_write')
          .where('c.year = :year', { year })
          .getOneOrFail();
      }
      row.lastNumber += 1;
      await repo.save(row);
      return row.lastNumber;
    };
    return manager ? run(manager) : this.ds.transaction(run);
  }

  async getCurrent(year: number): Promise<number> {
    const row = await this.ds.getRepository(InvoiceCounter).findOne({ where: { year } });
    return row?.lastNumber ?? 0;
  }

  async reset(year: number): Promise<void> {
    const repo = this.ds.getRepository(InvoiceCounter);
    const row = await repo.findOne({ where: { year } });
    if (!row) {
      await repo.insert({ year, lastNumber: 0 });
    } else {
      row.lastNumber = 0;
      await repo.save(row);
    }
  }
}
```

`src/counters/counters.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InvoiceCounter } from '../entities/invoice-counter.entity';
import { CountersService } from './counters.service';

@Module({
  imports: [TypeOrmModule.forFeature([InvoiceCounter])],
  providers: [CountersService],
  exports: [CountersService],
})
export class CountersModule {}
```

Add `CountersModule` to `src/app.module.ts` `imports`.

- [ ] **Step 4: Run, expect pass**

```bash
npx jest src/counters/counters.service.spec.ts
```

Expected: 3 PASS.

- [ ] **Step 5: Commit**

```bash
git add src/counters/ src/app.module.ts
git commit -m "feat(counters): per-year invoice counter with claim-next and reset"
```

---

### Task 3.5: Counter reset page (admin)

**Files:**
- Create: `src/counters/counters.controller.ts`, `views/pages/settings/counter.hbs`
- Modify: `src/counters/counters.module.ts`

- [ ] **Step 1: Controller**

`src/counters/counters.controller.ts`:

```typescript
import { Controller, Get, Post, Render, Res } from '@nestjs/common';
import { Response } from 'express';
import { CountersService } from './counters.service';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';

@Controller('settings/counter')
@Roles('admin')
export class CountersController {
  constructor(private readonly counters: CountersService) {}

  @Get() @Render('pages/settings/counter')
  async show(@CurrentUser() user: AuthUser) {
    const year = new Date().getFullYear();
    const last = await this.counters.getCurrent(year);
    return {
      title: `Invoice counter ${year}`, layout: 'layouts/main', user, isAdmin: true,
      year, lastNumber: last, nextNumber: String(last + 1).padStart(3, '0'),
    };
  }

  @Post('reset')
  async reset(@Res() res: Response) {
    await this.counters.reset(new Date().getFullYear());
    return res.redirect('/settings/counter');
  }
}
```

Add `controllers: [CountersController]` to `CountersModule`.

- [ ] **Step 2: View**

`views/pages/settings/counter.hbs`:

```handlebars
<h1>Invoice counter — {{year}}</h1>
<p>Last claimed: <strong>{{lastNumber}}</strong></p>
<p>Next invoice will be: <strong>{{nextNumber}}</strong></p>
<form method="post" action="/settings/counter/reset" onsubmit="return confirm('Reset {{year}} counter to 0? Next invoice will be 001.');">
  <button type="submit" class="primary danger" style="background:#b71c1c">Reset to 0</button>
</form>
```

- [ ] **Step 3: Manual verify**

```bash
npm run start:dev
```

Login as admin → `/settings/counter` shows current year and `Next: 001` (assuming test data was deleted) → click Reset → confirm → page reloads still showing `Next: 001`. Stop server.

- [ ] **Step 4: Commit**

```bash
git add src/counters/counters.controller.ts src/counters/counters.module.ts views/pages/settings/counter.hbs
git commit -m "feat(counters): admin counter page (current year, reset)"
```

---

### Task 3.6: Invoice service — create() with counter claim + tests

**Files:**
- Create: `src/invoices/invoices.module.ts`, `src/invoices/invoices.service.ts`, `src/invoices/invoices.service.spec.ts`, `src/invoices/dto/invoice-item.dto.ts`, `src/invoices/dto/invoice.dto.ts`
- Modify: `src/app.module.ts`

- [ ] **Step 1: DTOs**

`src/invoices/dto/invoice-item.dto.ts`:

```typescript
import { IsNumberString, IsOptional, IsString, MaxLength } from 'class-validator';

export class InvoiceItemDto {
  @IsString() @MaxLength(255) itemName!: string;
  @IsString() description!: string;
  @IsNumberString() unitCost!: string;
  @IsNumberString() quantity!: string;
  @IsOptional() @IsString() @MaxLength(255) quantityNote?: string;
}
```

`src/invoices/dto/invoice.dto.ts`:

```typescript
import { Transform, Type } from 'class-transformer';
import {
  ArrayMinSize, IsArray, IsDateString, IsInt, IsOptional, IsString, ValidateNested,
} from 'class-validator';
import { InvoiceItemDto } from './invoice-item.dto';

export class InvoiceDto {
  @IsInt() @Type(() => Number) customerId!: number;
  @IsDateString() invoiceDate!: string;
  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => InvoiceItemDto)
  items!: InvoiceItemDto[];
  @IsOptional() @IsString() amountInWords?: string;
}
```

- [ ] **Step 2: Failing test**

`src/invoices/invoices.service.spec.ts`:

```typescript
import { Test } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { InvoicesModule } from './invoices.module';
import { InvoicesService } from './invoices.service';
import { CustomersModule } from '../customers/customers.module';
import { CustomersService } from '../customers/customers.service';
import { SettingsModule } from '../settings/settings.module';
import { CountersModule } from '../counters/counters.module';
import { buildTypeOrmOptions } from '../config/typeorm.options';
import { validateEnv } from '../config/env.validation';

describe('InvoicesService.create (integration)', () => {
  let svc: InvoicesService; let customers: CustomersService; let ds: DataSource;
  let userId: number; let customerId: number;
  const YEAR = new Date().getFullYear();

  beforeAll(async () => {
    const mod = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
        TypeOrmModule.forRootAsync({
          inject: [ConfigService],
          useFactory: (config: ConfigService) => buildTypeOrmOptions(config),
        }),
        SettingsModule, CountersModule, CustomersModule, InvoicesModule,
      ],
    }).compile();
    svc = mod.get(InvoicesService);
    customers = mod.get(CustomersService);
    ds = mod.get(DataSource);

    await ds.query('DELETE FROM invoice_items');
    await ds.query('DELETE FROM invoice_revisions');
    await ds.query('DELETE FROM email_logs');
    await ds.query('DELETE FROM invoices');
    await ds.query('DELETE FROM invoice_counters WHERE year = ?', [YEAR]);

    await ds.query("DELETE FROM users WHERE email='svc-test@aquester.com'");
    const r = await ds.query(`INSERT INTO users(email,password_hash,role) VALUES('svc-test@aquester.com','x','admin')`);
    userId = r.insertId;

    const c = await customers.create({
      companyName: 'Acme', address: 'addr', primaryEmail: 'a@x.com',
      ccEmails: [], registrationNumber: undefined, phone: undefined, notes: undefined,
    });
    customerId = c.id;
  });

  afterAll(async () => { await ds.destroy(); });

  it('creates an invoice with claimed number 1, computes totals, status=draft', async () => {
    const inv = await svc.create({
      customerId,
      invoiceDate: '2025-09-22',
      items: [
        { itemName: 'Company Emails', description: '...', unitCost: '1600.00', quantity: '24', quantityNote: '8 X 3 (months)' },
        { itemName: 'Email Hosting',  description: '...', unitCost: '1000.00', quantity: '3',  quantityNote: '1 X 3 (months)' },
      ],
    }, userId);
    expect(inv.invoiceNumber).toBe(1);
    expect(inv.year).toBe(YEAR);
    expect(inv.subtotal).toBe('41400.00');
    expect(inv.vatAmount).toBe('5382.00');
    expect(inv.grandTotal).toBe('46782.00');
    expect(inv.status).toBe('draft');
    expect(inv.revision).toBe(1);
    expect(inv.amountInWords.startsWith('Forty-six thousand seven hundred eighty-two')).toBe(true);
    expect(inv.items.length).toBe(2);
    expect(inv.items[0].lineTotal).toBe('38400.00');
  });

  it('next invoice claims number 2', async () => {
    const inv = await svc.create({
      customerId, invoiceDate: '2025-09-23',
      items: [{ itemName: 'X', description: 'y', unitCost: '100', quantity: '1' }],
    }, userId);
    expect(inv.invoiceNumber).toBe(2);
  });
});
```

- [ ] **Step 3: Run, expect fail**

```bash
npx jest src/invoices/invoices.service.spec.ts
```

Expected: FAIL.

- [ ] **Step 4: Implement service + module**

`src/invoices/invoices.service.ts`:

```typescript
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Invoice } from '../entities/invoice.entity';
import { InvoiceItem } from '../entities/invoice-item.entity';
import { CountersService } from '../counters/counters.service';
import { SettingsService } from '../settings/settings.service';
import { computeLineTotal, computeTotals } from '../common/helpers/money';
import { amountInWords } from '../common/helpers/amount-in-words';
import { InvoiceDto } from './dto/invoice.dto';

@Injectable()
export class InvoicesService {
  constructor(
    @InjectDataSource() private readonly ds: DataSource,
    private readonly counters: CountersService,
    private readonly settings: SettingsService,
  ) {}

  async create(dto: InvoiceDto, userId: number): Promise<Invoice> {
    const settings = await this.settings.get();
    const year = new Date(dto.invoiceDate).getUTCFullYear();
    const totals = computeTotals(dto.items, settings.vatRate);
    const wordsDefault = amountInWords(totals.grandTotal, settings.currencyLabel);
    const words = dto.amountInWords?.trim() || wordsDefault;

    return this.ds.transaction(async (tx) => {
      const number = await this.counters.claimNext(year, tx);
      const invRepo = tx.getRepository(Invoice);
      const itemRepo = tx.getRepository(InvoiceItem);

      const invoice = await invRepo.save(invRepo.create({
        invoiceNumber: number,
        year,
        customerId: dto.customerId,
        invoiceDate: dto.invoiceDate,
        subtotal: totals.subtotal,
        vatRate: settings.vatRate,
        vatAmount: totals.vatAmount,
        grandTotal: totals.grandTotal,
        amountInWords: words,
        status: 'draft',
        revision: 1,
        createdBy: userId,
      }));

      await itemRepo.save(dto.items.map((it, idx) => ({
        invoiceId: invoice.id,
        sortOrder: idx,
        itemName: it.itemName,
        description: it.description,
        unitCost: it.unitCost,
        quantity: it.quantity,
        quantityNote: it.quantityNote,
        lineTotal: computeLineTotal(it.unitCost, it.quantity),
      })));

      return invRepo.findOneOrFail({
        where: { id: invoice.id },
        relations: ['items', 'customer'],
        order: { items: { sortOrder: 'ASC' } } as any,
      });
    });
  }

  async findOne(id: number): Promise<Invoice> {
    const inv = await this.ds.getRepository(Invoice).findOne({
      where: { id },
      relations: ['items', 'customer'],
      order: { items: { sortOrder: 'ASC' } } as any,
    });
    if (!inv) throw new NotFoundException(`Invoice ${id} not found`);
    return inv;
  }

  list(filters: { year?: number; customerId?: number; status?: string }): Promise<Invoice[]> {
    const qb = this.ds.getRepository(Invoice).createQueryBuilder('inv')
      .leftJoinAndSelect('inv.customer', 'customer')
      .orderBy('inv.year', 'DESC').addOrderBy('inv.invoiceNumber', 'DESC');
    if (filters.year) qb.andWhere('inv.year = :year', { year: filters.year });
    if (filters.customerId) qb.andWhere('inv.customerId = :cid', { cid: filters.customerId });
    if (filters.status) qb.andWhere('inv.status = :status', { status: filters.status });
    return qb.getMany();
  }
}
```

`src/invoices/invoices.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Invoice } from '../entities/invoice.entity';
import { InvoiceItem } from '../entities/invoice-item.entity';
import { InvoicesService } from './invoices.service';
import { CountersModule } from '../counters/counters.module';
import { SettingsModule } from '../settings/settings.module';

@Module({
  imports: [TypeOrmModule.forFeature([Invoice, InvoiceItem]), CountersModule, SettingsModule],
  providers: [InvoicesService],
  exports: [InvoicesService],
})
export class InvoicesModule {}
```

Add `InvoicesModule` to `src/app.module.ts` `imports`.

- [ ] **Step 5: Run, expect pass**

```bash
npx jest src/invoices/invoices.service.spec.ts
```

Expected: 2 PASS.

- [ ] **Step 6: Commit**

```bash
git add src/invoices/ src/app.module.ts
git commit -m "feat(invoices): InvoicesService.create with counter claim and totals"
```

---

### Task 3.7: PDF service — Puppeteer wrapper + tests

**Files:**
- Create: `src/pdf/pdf.module.ts`, `src/pdf/pdf.service.ts`, `src/pdf/pdf.service.spec.ts`
- Modify: `src/app.module.ts`

- [ ] **Step 1: Failing test**

`src/pdf/pdf.service.spec.ts`:

```typescript
import { PdfService } from './pdf.service';

describe('PdfService', () => {
  let svc: PdfService;
  beforeAll(() => {
    process.env.PDF_STORAGE_DIR = process.env.PDF_STORAGE_DIR || './storage/invoices';
    svc = new PdfService({ get: (k: string) => process.env[k] } as any);
  });

  afterAll(async () => { await svc.shutdown(); });

  it('renders a simple HTML to a PDF buffer with %PDF- header', async () => {
    const buf = await svc.renderHtmlToBuffer('<html><body><h1>Hi</h1></body></html>');
    expect(buf.length).toBeGreaterThan(500);
    expect(buf.slice(0, 4).toString()).toBe('%PDF');
  }, 60_000);
});
```

- [ ] **Step 2: Run, expect fail**

```bash
npx jest src/pdf/pdf.service.spec.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement**

`src/pdf/pdf.service.ts`:

```typescript
import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mkdir, writeFile } from 'fs/promises';
import { dirname, join, resolve } from 'path';
import puppeteer, { Browser } from 'puppeteer';

@Injectable()
export class PdfService implements OnModuleDestroy {
  private browser?: Browser;
  constructor(private readonly config: ConfigService) {}

  private async getBrowser(): Promise<Browser> {
    if (!this.browser) {
      this.browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });
    }
    return this.browser;
  }

  async renderHtmlToBuffer(html: string): Promise<Buffer> {
    const browser = await this.getBrowser();
    const page = await browser.newPage();
    try {
      await page.setContent(html, { waitUntil: 'networkidle0' });
      const buf = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '15mm', bottom: '15mm', left: '15mm', right: '15mm' },
      });
      return Buffer.from(buf);
    } finally {
      await page.close();
    }
  }

  async writeBufferToDisk(buf: Buffer, fileName: string): Promise<string> {
    const dir = resolve(this.config.get<string>('PDF_STORAGE_DIR') || './storage/invoices');
    const path = join(dir, fileName);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, buf);
    return path;
  }

  async onModuleDestroy() { await this.shutdown(); }

  async shutdown() {
    if (this.browser) {
      await this.browser.close();
      this.browser = undefined;
    }
  }
}
```

`src/pdf/pdf.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { PdfService } from './pdf.service';

@Module({ providers: [PdfService], exports: [PdfService] })
export class PdfModule {}
```

Add `PdfModule` to `src/app.module.ts` `imports`.

- [ ] **Step 4: Run, expect pass**

```bash
npx jest src/pdf/pdf.service.spec.ts
```

Expected: PASS. (First run downloads Chromium — may take 30–60s if not cached. If puppeteer didn't auto-download Chromium, run `npx puppeteer browsers install chrome`.)

- [ ] **Step 5: Commit**

```bash
git add src/pdf/ src/app.module.ts
git commit -m "feat(pdf): Puppeteer wrapper with browser singleton"
```

---

### Task 3.8: Invoice PDF Handlebars template

**Files:**
- Create: `views/invoice-pdf.hbs`

- [ ] **Step 1: Write the template**

`views/invoice-pdf.hbs`:

```handlebars
<!doctype html>
<html><head><meta charset="utf-8"/>
<style>
  *, *::before, *::after { box-sizing: border-box; }
  body { margin: 0; font-family: Arial, sans-serif; color: #333; font-size: 11pt; }
  .page { padding: 0; }
  header.bands { display: grid; grid-template-columns: 1fr 1.4fr 1.4fr; gap: 1.5rem;
    align-items: center; padding-bottom: 0.75rem; border-bottom: 2px solid #222; }
  header.bands img.logo { max-width: 200px; max-height: 90px; }
  header.bands .col { padding: 0 1rem; border-left: 1px solid #ccc; }
  header.bands .col.first { border-left: 0; }
  header.bands .label { font-weight: 700; color: #555; letter-spacing: 0.05em; }
  header.bands .name { font-weight: 700; }
  header.bands .to-name { font-weight: 700; }
  .title { text-align: center; margin: 2.5rem 0 2rem; }
  .title .pill { display: inline-block; background: #e89c1f; color: #111; font-weight: 800;
    font-style: italic; padding: 0.6rem 2.5rem; border-radius: 999px; font-size: 24pt; }
  .meta { display: flex; gap: 3rem; padding: 0 0 1.5rem 0; font-weight: 700; }
  .meta .label { color: #555; }
  table.items { width: 100%; border-collapse: collapse; }
  table.items th, table.items td { padding: 0.6rem 0.8rem; text-align: left; vertical-align: top; }
  table.items th { color: #555; font-weight: 700; border-bottom: 0; }
  table.items td { border-left: 1px solid #ccc; }
  table.items td:first-child, table.items th:first-child { border-left: 0; }
  table.items td.num, table.items th.num { text-align: right; white-space: nowrap; }
  table.items td.qty { text-align: center; }
  .totals { width: 100%; margin-top: 1rem; border-collapse: collapse; }
  .totals td { padding: 0.4rem 0.8rem; }
  .totals td.label { text-align: right; font-weight: 700; }
  .totals td.value { text-align: right; font-weight: 700; white-space: nowrap; width: 140px; }
  .totals tr.grand td { font-size: 14pt; }
  .in-words { margin-top: 1rem; font-weight: 700; }
  footer { margin-top: 3rem; font-size: 11pt; line-height: 1.5; }
  footer .block { font-weight: 700; }
  .correction { margin-top: 1rem; padding: 0.6rem 0.8rem; background: #fff7e0;
    border-left: 4px solid #e89c1f; font-style: italic; }
</style></head>
<body><div class="page">
  <header class="bands">
    <div class="col first">
      <img class="logo" src="{{logoSrc}}" alt="Aquester"/>
    </div>
    <div class="col">
      <div class="label">FROM:</div>
      <div class="name">{{settings.fromCompanyName}}</div>
      <div>{{{nl2br settings.fromAddress}}}</div>
      <div>PAN No. {{settings.fromPan}}</div>
      <div>{{settings.fromEmail}}</div>
    </div>
    <div class="col">
      <div class="label">TO:</div>
      <div class="to-name">{{customer.companyName}}</div>
      <div>{{{nl2br customer.address}}}</div>
      {{#if customer.registrationNumber}}<div>Reg/PAN: {{customer.registrationNumber}}</div>{{/if}}
    </div>
  </header>

  <div class="title"><span class="pill">Invoice</span></div>

  <div class="meta">
    <div><span class="label">INVOICE NO.</span> {{invoiceNumberPadded}}</div>
    <div><span class="label">INVOICE DATE:</span> {{invoiceDateFormatted}}</div>
  </div>

  {{#if isCorrection}}
    <div class="correction">Correction notice — please discard the previously issued copy of invoice {{invoiceNumberPadded}}.</div>
  {{/if}}

  <table class="items">
    <thead>
      <tr>
        <th>ITEM</th><th>DESCRIPTION</th>
        <th class="num">UNIT COST</th><th class="qty">QUANTITY</th><th class="num">TOTAL</th>
      </tr>
    </thead>
    <tbody>
      {{#each items}}
        <tr>
          <td>{{this.itemName}}</td>
          <td>{{this.description}}</td>
          <td class="num">{{numFmt this.unitCost}}</td>
          <td class="qty">
            {{numFmt this.quantity}}
            {{#if this.quantityNote}}<br><small>{{this.quantityNote}}</small>{{/if}}
          </td>
          <td class="num">{{numFmt this.lineTotal}}</td>
        </tr>
      {{/each}}
    </tbody>
  </table>

  <table class="totals">
    <tr><td class="label">Subtotal</td><td class="value">{{numFmt subtotal}}</td></tr>
    <tr><td class="label">VAT {{vatRateFmt}}%</td><td class="value">{{numFmt vatAmount}}</td></tr>
    <tr class="grand"><td class="label">Total</td><td class="value">{{numFmt grandTotal}}</td></tr>
  </table>

  <p class="in-words">In words: {{amountInWords}}</p>

  <footer>
    <div class="block">{{{nl2br settings.bankDetails}}}</div>
    <p>If you have any questions regarding this invoice, please contact:</p>
    <div class="block">{{settings.contactName}}</div>
    <div class="block">{{settings.contactEmail}}</div>
    <div class="block">Phone: {{settings.contactPhone}}</div>
  </footer>
</div></body></html>
```

- [ ] **Step 2: Register hbs helpers (`numFmt`, `nl2br`)**

Update `src/main.ts` to register helpers right after partials registration:

```typescript
hbs.registerHelper('numFmt', (v: string | number) =>
  Number(v).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
);
hbs.registerHelper('nl2br', (s: string) => (s ?? '').toString().replace(/\n/g, '<br>'));
```

Apply the same registrations in `test/e2e/test-helpers.ts` so PDF/email render the same way under tests.

- [ ] **Step 3: Commit**

```bash
git add views/invoice-pdf.hbs src/main.ts test/e2e/test-helpers.ts
git commit -m "feat(view): invoice PDF template with Aquester layout + hbs helpers"
```

---

### Task 3.9: Tie PDF generation to invoices: `pdf` endpoint + storage

**Files:**
- Create: `src/invoices/invoice-mapper.ts`
- Modify: `src/invoices/invoices.service.ts` (add `renderPdfModel(id)`), `src/invoices/invoices.module.ts` (import PdfModule), `src/invoices/invoices.controller.ts` (created in next task — for now create only the renderer)

- [ ] **Step 1: View-model mapper**

`src/invoices/invoice-mapper.ts`:

```typescript
import { Invoice } from '../entities/invoice.entity';
import { Settings } from '../entities/settings.entity';
import { formatInvoiceDate } from '../common/helpers/date-format';

export function buildPdfModel(invoice: Invoice, settings: Settings, logoSrc: string) {
  return {
    invoiceNumberPadded: String(invoice.invoiceNumber).padStart(3, '0'),
    invoiceDateFormatted: formatInvoiceDate(invoice.invoiceDate),
    isCorrection: invoice.status === 'corrected',
    items: invoice.items,
    subtotal: invoice.subtotal,
    vatRateFmt: Number(invoice.vatRate).toFixed(2).replace(/\.00$/, ''),
    vatAmount: invoice.vatAmount,
    grandTotal: invoice.grandTotal,
    amountInWords: invoice.amountInWords,
    customer: invoice.customer,
    settings,
    logoSrc,
  };
}
```

- [ ] **Step 2: Service method to render bytes**

Append to `src/invoices/invoices.service.ts` (and add the constructor deps):

```typescript
// add imports at the top:
// import { PdfService } from '../pdf/pdf.service';
// import { buildPdfModel } from './invoice-mapper';
// import { join, resolve } from 'path';
// import { ConfigService } from '@nestjs/config';
// import * as Hbs from 'hbs';
// import { readFile } from 'fs/promises';

// extend the constructor:
//   private readonly pdf: PdfService,
//   private readonly config: ConfigService,

  async renderPdf(id: number): Promise<{ buffer: Buffer; path: string; fileName: string }> {
    const invoice = await this.findOne(id);
    const settings = await this.settings.get();
    const logoAbs = resolve(settings.logoPath ?? 'public/logo.png');
    const logoSrc = `file://${logoAbs}`;
    const tplPath = resolve('views/invoice-pdf.hbs');
    const tplSrc = await readFile(tplPath, 'utf8');
    const tpl = Hbs.compile(tplSrc);
    const html = tpl(buildPdfModel(invoice, settings, logoSrc));
    const buffer = await this.pdf.renderHtmlToBuffer(html);
    const fileName = `${invoice.year}-${String(invoice.invoiceNumber).padStart(3, '0')}-r${invoice.revision}.pdf`;
    const path = await this.pdf.writeBufferToDisk(buffer, fileName);
    return { buffer, path, fileName };
  }
```

(Add the matching imports/`ConfigService`/`PdfService` injection to the constructor; `import * as Hbs from 'hbs'`.)

Update `src/invoices/invoices.module.ts` imports:

```typescript
import { PdfModule } from '../pdf/pdf.module';
// ...
imports: [TypeOrmModule.forFeature([Invoice, InvoiceItem]), CountersModule, SettingsModule, PdfModule],
```

- [ ] **Step 3: Commit**

```bash
git add src/invoices/
git commit -m "feat(invoices): PDF render method using hbs template + Puppeteer"
```

---

### Task 3.10: Invoices controller + form view + view page

**Files:**
- Create: `src/invoices/invoices.controller.ts`, `views/pages/invoices/{form,view,list}.hbs`
- Modify: `src/invoices/invoices.module.ts`

- [ ] **Step 1: Controller**

`src/invoices/invoices.controller.ts`:

```typescript
import {
  Body, Controller, Get, Param, ParseIntPipe, Post, Query, Render, Res,
} from '@nestjs/common';
import { Response } from 'express';
import { InvoicesService } from './invoices.service';
import { InvoiceDto } from './dto/invoice.dto';
import { CustomersService } from '../customers/customers.service';
import { SettingsService } from '../settings/settings.service';
import { CountersService } from '../counters/counters.service';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { buildPdfModel } from './invoice-mapper';
import { resolve } from 'path';

@Controller('invoices')
export class InvoicesController {
  constructor(
    private readonly svc: InvoicesService,
    private readonly customers: CustomersService,
    private readonly settings: SettingsService,
    private readonly counters: CountersService,
  ) {}

  @Get() @Render('pages/invoices/list')
  async list(
    @CurrentUser() user: AuthUser,
    @Query('year') year?: string,
    @Query('customerId') customerId?: string,
    @Query('status') status?: string,
  ) {
    const yearNum = year ? Number(year) : undefined;
    const cidNum = customerId ? Number(customerId) : undefined;
    const invoices = await this.svc.list({ year: yearNum, customerId: cidNum, status });
    const customers = await this.customers.list();
    return {
      title: 'Invoices', layout: 'layouts/main', user, isAdmin: user.role === 'admin',
      invoices, customers, year: yearNum ?? '', customerId: cidNum ?? '', status: status ?? '',
    };
  }

  @Roles('admin') @Get('new') @Render('pages/invoices/form')
  async newForm(@CurrentUser() user: AuthUser, @Query('customerId') customerIdRaw?: string) {
    const customers = await this.customers.list();
    const settings = await this.settings.get();
    const year = new Date().getFullYear();
    const lastNumber = await this.counters.getCurrent(year);
    const today = new Date().toISOString().slice(0, 10);
    const customerId = customerIdRaw ? Number(customerIdRaw) : (customers[0]?.id ?? 0);
    return {
      title: 'New invoice', layout: 'layouts/main', user, isAdmin: true,
      action: '/invoices/new', mode: 'create',
      customers, settings,
      defaults: {
        customerId, invoiceDate: today,
        nextNumber: String(lastNumber + 1).padStart(3, '0'),
        items: [{ itemName: '', description: '', unitCost: '', quantity: '1', quantityNote: '' }],
        amountInWords: '',
      },
    };
  }

  @Roles('admin') @Post('new')
  async createSubmit(@Body() dto: InvoiceDto, @CurrentUser() user: AuthUser, @Res() res: Response) {
    const inv = await this.svc.create(dto, user.id);
    await this.svc.renderPdf(inv.id); // pre-generate so download is instant
    return res.redirect(`/invoices/${inv.id}`);
  }

  @Get(':id') @Render('pages/invoices/view')
  async view(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthUser) {
    const invoice = await this.svc.findOne(id);
    const settings = await this.settings.get();
    const logoSrc = `/public/logo.png`;
    const model = buildPdfModel(invoice, settings, logoSrc);
    return {
      title: `Invoice ${model.invoiceNumberPadded}`, layout: 'layouts/main', user,
      isAdmin: user.role === 'admin', invoice, model,
    };
  }

  @Get(':id/pdf')
  async pdf(@Param('id', ParseIntPipe) id: number, @Res() res: Response) {
    const { buffer, fileName } = await this.svc.renderPdf(id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${fileName}"`);
    return res.end(buffer);
  }
}
```

Add `controllers: [InvoicesController]` and `imports: [..., CustomersModule]` to `InvoicesModule`. (Re-export not needed; just import to provide `CustomersService`.)

- [ ] **Step 2: Form view (Alpine.js)**

`views/pages/invoices/form.hbs`:

```handlebars
<h1>{{title}}</h1>
<form method="post" action="{{action}}" x-data="invoiceForm({{json defaults}}, {{settings.vatRate}}, '{{settings.currencyLabel}}')" @submit="onSubmit($event)">
  <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:1rem; max-width:720px">
    <div>
      <label>Customer</label>
      <select name="customerId" x-model="form.customerId" required>
        {{#each customers}}<option value="{{this.id}}">{{this.companyName}}</option>{{/each}}
      </select>
    </div>
    <div>
      <label>Invoice date</label>
      <input type="date" name="invoiceDate" x-model="form.invoiceDate" required/>
    </div>
    <div>
      <label>Invoice number (auto)</label>
      <input value="{{defaults.nextNumber}}" disabled/>
    </div>
  </div>

  <h2>Items</h2>
  <table>
    <thead><tr><th>Item</th><th>Description</th><th>Unit cost</th><th>Qty</th><th>Qty note</th><th>Total</th><th></th></tr></thead>
    <tbody>
      <template x-for="(it, i) in form.items" :key="i">
        <tr>
          <td><input :name="`items[${i}][itemName]`" x-model="it.itemName" required></td>
          <td><textarea :name="`items[${i}][description]`" x-model="it.description" rows="2" required></textarea></td>
          <td><input type="number" step="0.01" :name="`items[${i}][unitCost]`" x-model="it.unitCost" @input="recalc()" required></td>
          <td><input type="number" step="0.01" :name="`items[${i}][quantity]`" x-model="it.quantity" @input="recalc()" required></td>
          <td><input :name="`items[${i}][quantityNote]`" x-model="it.quantityNote" placeholder="e.g. 8 X 3 (months)"></td>
          <td x-text="formatMoney(lineTotal(it))"></td>
          <td><button type="button" @click="removeRow(i)">×</button></td>
        </tr>
      </template>
    </tbody>
  </table>
  <button type="button" @click="addRow()" style="margin-top:0.5rem">+ Add row</button>

  <div style="margin-top:1rem; max-width:360px; margin-left:auto; text-align:right">
    <div>Subtotal: <strong x-text="formatMoney(subtotal)"></strong></div>
    <div>VAT <span x-text="vatRate"></span>%: <strong x-text="formatMoney(vatAmount)"></strong></div>
    <div style="font-size:1.1rem">Total: <strong x-text="formatMoney(grandTotal)"></strong></div>
  </div>

  <div style="margin-top:1rem; max-width:560px">
    <label>Amount in words (auto, editable)</label>
    <textarea name="amountInWords" x-model="form.amountInWords" rows="2"></textarea>
  </div>

  <button type="submit" class="primary" style="margin-top:1rem">Save invoice</button>
</form>

<script src="/public/alpine.min.js" defer></script>
<script>
function invoiceForm(defaults, vatRate, currency) {
  return {
    form: defaults,
    vatRate: vatRate,
    init() { this.recalc(); },
    addRow() { this.form.items.push({ itemName:'', description:'', unitCost:'', quantity:'1', quantityNote:'' }); this.recalc(); },
    removeRow(i) { this.form.items.splice(i,1); if (this.form.items.length === 0) this.addRow(); this.recalc(); },
    lineTotal(it) { const u = Number(it.unitCost) || 0; const q = Number(it.quantity) || 0; return Math.round(u*q*100)/100; },
    get subtotal() { return Math.round(this.form.items.reduce((a,it)=>a + this.lineTotal(it), 0) * 100) / 100; },
    get vatAmount() { return Math.round(this.subtotal * (Number(this.vatRate)/100) * 100) / 100; },
    get grandTotal() { return Math.round((this.subtotal + this.vatAmount) * 100) / 100; },
    formatMoney(n) { return Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); },
    recalc() {
      // amount-in-words: lazy regen (only if user hasn't typed)
      if (!this.form.amountInWords || this.form.amountInWords.startsWith('(auto) ')) {
        this.form.amountInWords = '(auto) ' + this.toWords(this.grandTotal) + ' ' + currency + ' only.';
      }
    },
    toWords(n) {
      const ones=['zero','one','two','three','four','five','six','seven','eight','nine','ten','eleven','twelve','thirteen','fourteen','fifteen','sixteen','seventeen','eighteen','nineteen'];
      const tens=['','','twenty','thirty','forty','fifty','sixty','seventy','eighty','ninety'];
      function w(num){
        if (num < 20) return ones[num];
        if (num < 100) return tens[Math.floor(num/10)] + (num%10 ? '-' + ones[num%10] : '');
        if (num < 1000) return ones[Math.floor(num/100)] + ' hundred' + (num%100 ? ' ' + w(num%100) : '');
        if (num < 1_000_000) return w(Math.floor(num/1000)) + ' thousand' + (num%1000 ? ' ' + w(num%1000) : '');
        return num.toString();
      }
      const whole = Math.floor(n); const cents = Math.round((n-whole)*100);
      let s = w(whole); s = s.charAt(0).toUpperCase() + s.slice(1);
      return cents ? s + ' ' + currency + ' and ' + w(cents) + ' paisa' : s;
    },
    onSubmit(e) {
      // strip the (auto) tag if user didn't edit
      if (this.form.amountInWords.startsWith('(auto) ')) {
        this.form.amountInWords = this.form.amountInWords.slice(7);
      }
    },
  };
}
</script>
```

Add `json` hbs helper in `src/main.ts` and `test/e2e/test-helpers.ts`:

```typescript
hbs.registerHelper('json', (v: unknown) => new (require('hbs')).SafeString(JSON.stringify(v ?? null)));
```

Vendor a copy of Alpine.js into `public/alpine.min.js`:

```bash
curl -L https://unpkg.com/alpinejs@3.x.x/dist/cdn.min.js -o public/alpine.min.js
```

(Replace `3.x.x` with the latest 3.x version printed by `npm view alpinejs version`.)

- [ ] **Step 3: View page**

`views/pages/invoices/view.hbs`:

```handlebars
<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem">
  <h1>Invoice {{model.invoiceNumberPadded}} — {{model.customer.companyName}}</h1>
  <div>
    <a href="/invoices/{{invoice.id}}/pdf" class="primary" style="padding:0.5rem 0.9rem; background:#c69214; color:#fff; border-radius:4px; text-decoration:none;">Download PDF</a>
    {{#if isAdmin}}<a href="/invoices/{{invoice.id}}/edit" style="margin-left:0.75rem">Edit</a>{{/if}}
    {{#if isAdmin}}<a href="/invoices/{{invoice.id}}/email" style="margin-left:0.75rem">Email</a>{{/if}}
  </div>
</div>
<iframe src="/invoices/{{invoice.id}}/pdf" style="width:100%; height:1100px; border:1px solid #ddd"></iframe>
```

- [ ] **Step 4: List view**

`views/pages/invoices/list.hbs`:

```handlebars
<div style="display:flex; justify-content:space-between; align-items:center;">
  <h1>Invoices</h1>
  {{#if isAdmin}}<a href="/invoices/new" class="primary" style="padding:0.5rem 0.9rem; background:#c69214; color:#fff; border-radius:4px; text-decoration:none;">+ New invoice</a>{{/if}}
</div>
<form method="get" action="/invoices" style="display:flex; gap:0.5rem; margin-bottom:1rem">
  <input name="year" value="{{year}}" placeholder="Year" style="width:90px"/>
  <select name="customerId">
    <option value="">All customers</option>
    {{#each customers}}<option value="{{this.id}}" {{#if (eq ../customerId this.id)}}selected{{/if}}>{{this.companyName}}</option>{{/each}}
  </select>
  <select name="status">
    <option value="">All statuses</option>
    <option value="draft"     {{#if (eq status 'draft')}}selected{{/if}}>Draft</option>
    <option value="sent"      {{#if (eq status 'sent')}}selected{{/if}}>Sent</option>
    <option value="corrected" {{#if (eq status 'corrected')}}selected{{/if}}>Corrected</option>
  </select>
  <button type="submit">Filter</button>
</form>
<table>
  <thead><tr><th>#</th><th>Date</th><th>Customer</th><th>Total</th><th>Status</th><th></th></tr></thead>
  <tbody>
    {{#each invoices}}
      <tr>
        <td>{{this.year}}-{{padNum this.invoiceNumber}}</td>
        <td>{{this.invoiceDate}}</td>
        <td>{{this.customer.companyName}}</td>
        <td>{{numFmt this.grandTotal}}</td>
        <td>{{this.status}}</td>
        <td><a href="/invoices/{{this.id}}">View</a></td>
      </tr>
    {{else}}
      <tr><td colspan="6">No invoices yet.</td></tr>
    {{/each}}
  </tbody>
</table>
```

Register `eq` and `padNum` helpers (in both `src/main.ts` and `test/e2e/test-helpers.ts`):

```typescript
hbs.registerHelper('eq', (a: unknown, b: unknown) => String(a) === String(b));
hbs.registerHelper('padNum', (n: number) => String(n).padStart(3, '0'));
```

- [ ] **Step 5: Manual verify**

```bash
npm run start:dev
```

Login as admin → `/customers/new` → create one customer if you don't have one → `/invoices/new?customerId=…` → form pre-fills today's date and `Next: 001` → add a row, type 1600 / 24 / "8 X 3 (months)" → totals tick live → save → land on `/invoices/:id` showing PDF in iframe → click "Download PDF" → PDF should look like your example. Check `storage/invoices/` has `2026-001-r1.pdf`.

- [ ] **Step 6: Commit**

```bash
git add src/invoices/ views/pages/invoices/ src/main.ts test/e2e/test-helpers.ts public/alpine.min.js
git commit -m "feat(invoices): create form (Alpine.js), view page, list page, PDF download"
```

---

### Task 3.11: E2E test — create invoice, download PDF, list filter

**Files:**
- Create: `test/e2e/invoices.e2e-spec.ts`

- [ ] **Step 1: Test**

`test/e2e/invoices.e2e-spec.ts`:

```typescript
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { DataSource } from 'typeorm';
import { bootstrapTestApp, ensureUser, loginAndGetCookie } from './test-helpers';

describe('Invoices (e2e)', () => {
  let app: INestApplication;
  let adminCookie: string;
  let customerId: number;
  const YEAR = new Date().getFullYear();

  beforeAll(async () => {
    app = await bootstrapTestApp();
    await ensureUser(app, 'admin-inv@aquester.com', 'pw1', 'admin');
    adminCookie = await loginAndGetCookie(app, 'admin-inv@aquester.com', 'pw1');
    const ds = app.get(DataSource);
    await ds.query('DELETE FROM invoice_items');
    await ds.query('DELETE FROM invoice_revisions');
    await ds.query('DELETE FROM email_logs');
    await ds.query('DELETE FROM invoices');
    await ds.query('DELETE FROM invoice_counters WHERE year = ?', [YEAR]);
    await ds.query('DELETE FROM customer_cc_emails');
    await ds.query('DELETE FROM customers');
    const ins = await ds.query(`INSERT INTO customers(company_name,address,primary_email) VALUES('Acme','Kathmandu','a@x.com')`);
    customerId = ins.insertId;
  });

  afterAll(async () => { await app.close(); });

  it('admin creates an invoice and the PDF endpoint returns a PDF', async () => {
    const create = await request(app.getHttpServer())
      .post('/invoices/new').set('Cookie', adminCookie)
      .send({
        customerId,
        invoiceDate: `${YEAR}-09-22`,
        items: [
          { itemName: 'Company Emails', description: '...', unitCost: '1600.00', quantity: '24', quantityNote: '8 X 3 (months)' },
          { itemName: 'Email Hosting',  description: '...', unitCost: '1000.00', quantity: '3',  quantityNote: '1 X 3 (months)' },
        ],
      })
      .expect(302);
    const newPath = create.headers.location;
    expect(newPath).toMatch(/^\/invoices\/\d+$/);
    const id = Number(newPath.split('/').pop());

    const pdf = await request(app.getHttpServer())
      .get(`/invoices/${id}/pdf`).set('Cookie', adminCookie).expect(200);
    expect(pdf.headers['content-type']).toBe('application/pdf');
    expect(pdf.body.slice(0, 4).toString()).toBe('%PDF');
  }, 60_000);

  it('list filters by customer', async () => {
    const res = await request(app.getHttpServer())
      .get(`/invoices?customerId=${customerId}`).set('Cookie', adminCookie).expect(200);
    expect(res.text).toContain('Acme');
    expect(res.text).toContain(`${YEAR}-001`);
  });
});
```

- [ ] **Step 2: Run, expect pass**

```bash
npm run test:e2e -- invoices
```

Expected: 2 PASS. (First run downloads Chromium if missing.)

- [ ] **Step 3: Commit**

```bash
git add test/e2e/invoices.e2e-spec.ts
git commit -m "test(invoices): e2e for create + PDF download + list filter"
```

---

### Task 3.12: Manual smoke check — Phase 3 done

- [ ] **Step 1: Push**

```bash
git push
```

- [ ] **Step 2: Verify**
  - Counter page shows `Next: 002` (or `001` after reset)
  - Creating an invoice produces a PDF visually matching your example (logo, FROM/TO bands, orange "Invoice" pill, items, totals, in-words, footer)
  - Filtering the list works
  - `npm test && npm run test:e2e` all green

Phase 3 done.

---

# PHASE 4 — Edit, Email & Polish

End state: admin can edit an invoice (with revision tracking after first send), preview & email it through Gmail SMTP with editable subject and CCs, and the app has 403/404/500 pages, a dashboard with recent invoices, and a README. Users module ships so the admin can add a viewer account.

---

### Task 4.1: Invoice edit (draft path) — service + controller

**Files:**
- Modify: `src/invoices/invoices.service.ts` (add `update()`), `src/invoices/invoices.controller.ts`
- Create: `views/pages/invoices/form.hbs` already exists; reuse for edit

- [ ] **Step 1: Failing test extension**

Append to `src/invoices/invoices.service.spec.ts`:

```typescript
  it('updates a draft in place (no revision row)', async () => {
    const inv = await svc.create({
      customerId, invoiceDate: '2025-09-22',
      items: [{ itemName: 'X', description: 'd', unitCost: '100', quantity: '2' }],
    }, userId);

    const updated = await svc.update(inv.id, {
      customerId, invoiceDate: '2025-09-23',
      items: [{ itemName: 'Y', description: 'd', unitCost: '50', quantity: '4' }],
    }, userId);

    expect(updated.invoiceNumber).toBe(inv.invoiceNumber); // number stable
    expect(updated.revision).toBe(1);                       // no revision bump for draft
    expect(updated.subtotal).toBe('200.00');
    expect(updated.items[0].itemName).toBe('Y');

    const revs = await ds.query('SELECT count(*) c FROM invoice_revisions WHERE invoice_id = ?', [inv.id]);
    expect(Number(revs[0].c)).toBe(0);
  });
```

- [ ] **Step 2: Run, expect fail**

```bash
npx jest src/invoices/invoices.service.spec.ts -t "updates a draft"
```

Expected: FAIL ("svc.update is not a function").

- [ ] **Step 3: Implement update() (draft path only for now)**

Append to `src/invoices/invoices.service.ts`:

```typescript
  async update(id: number, dto: InvoiceDto, _userId: number): Promise<Invoice> {
    const settings = await this.settings.get();
    const totals = computeTotals(dto.items, settings.vatRate);
    const wordsDefault = amountInWords(totals.grandTotal, settings.currencyLabel);
    const words = dto.amountInWords?.trim() || wordsDefault;

    return this.ds.transaction(async (tx) => {
      const invRepo = tx.getRepository(Invoice);
      const itemRepo = tx.getRepository(InvoiceItem);
      const current = await invRepo.findOne({ where: { id }, relations: ['items'] });
      if (!current) throw new NotFoundException(`Invoice ${id} not found`);

      // Phase 4 step 1: draft only. Sent/corrected handled in next task.
      if (current.status !== 'draft') {
        throw new Error('Edit-after-send not implemented yet (Task 4.2)');
      }

      Object.assign(current, {
        customerId: dto.customerId,
        invoiceDate: dto.invoiceDate,
        subtotal: totals.subtotal,
        vatAmount: totals.vatAmount,
        grandTotal: totals.grandTotal,
        amountInWords: words,
      });
      await invRepo.save(current);

      await itemRepo.delete({ invoiceId: id });
      await itemRepo.save(dto.items.map((it, idx) => ({
        invoiceId: id, sortOrder: idx,
        itemName: it.itemName, description: it.description,
        unitCost: it.unitCost, quantity: it.quantity, quantityNote: it.quantityNote,
        lineTotal: computeLineTotal(it.unitCost, it.quantity),
      })));

      return invRepo.findOneOrFail({
        where: { id }, relations: ['items', 'customer'],
        order: { items: { sortOrder: 'ASC' } } as any,
      });
    });
  }
```

- [ ] **Step 4: Run, expect pass**

```bash
npx jest src/invoices/invoices.service.spec.ts
```

Expected: 3 PASS.

- [ ] **Step 5: Edit endpoints**

Add to `src/invoices/invoices.controller.ts`:

```typescript
  @Roles('admin') @Get(':id/edit') @Render('pages/invoices/form')
  async editForm(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthUser) {
    const invoice = await this.svc.findOne(id);
    const customers = await this.customers.list();
    const settings = await this.settings.get();
    return {
      title: `Edit invoice ${String(invoice.invoiceNumber).padStart(3, '0')}`,
      layout: 'layouts/main', user, isAdmin: true,
      action: `/invoices/${id}/edit`, mode: 'edit',
      customers, settings,
      defaults: {
        customerId: invoice.customerId,
        invoiceDate: invoice.invoiceDate,
        nextNumber: String(invoice.invoiceNumber).padStart(3, '0'),
        items: invoice.items.map((it) => ({
          itemName: it.itemName, description: it.description,
          unitCost: it.unitCost, quantity: it.quantity, quantityNote: it.quantityNote,
        })),
        amountInWords: invoice.amountInWords,
      },
    };
  }

  @Roles('admin') @Post(':id/edit')
  async editSubmit(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: InvoiceDto,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ) {
    await this.svc.update(id, dto, user.id);
    await this.svc.renderPdf(id);
    return res.redirect(`/invoices/${id}`);
  }
```

- [ ] **Step 6: Manual verify**

Boot, login as admin, edit a draft invoice, confirm PDF regenerates with new numbers.

- [ ] **Step 7: Commit**

```bash
git add src/invoices/
git commit -m "feat(invoices): edit draft (in-place update + PDF regen)"
```

---

### Task 4.2: Invoice edit — sent/corrected → revision snapshot

**Files:**
- Modify: `src/invoices/invoices.service.ts`

- [ ] **Step 1: Failing test**

Append to `src/invoices/invoices.service.spec.ts`:

```typescript
  it('edit after send creates a revision row, bumps revision, sets status=corrected', async () => {
    const inv = await svc.create({
      customerId, invoiceDate: '2025-09-22',
      items: [{ itemName: 'A', description: 'd', unitCost: '100', quantity: '1' }],
    }, userId);

    // simulate a send: flip status manually (real send is in Phase 4 Task 4.5)
    await ds.query(`UPDATE invoices SET status='sent', sent_at = NOW() WHERE id = ?`, [inv.id]);

    const updated = await svc.update(inv.id, {
      customerId, invoiceDate: '2025-09-23',
      items: [{ itemName: 'A-fixed', description: 'd', unitCost: '120', quantity: '1' }],
    }, userId);

    expect(updated.status).toBe('corrected');
    expect(updated.revision).toBe(2);
    expect(updated.subtotal).toBe('120.00');

    const revs = await ds.query('SELECT count(*) c FROM invoice_revisions WHERE invoice_id = ?', [inv.id]);
    expect(Number(revs[0].c)).toBe(1);

    const [snapRow] = await ds.query(
      'SELECT revision_number, snapshot_json FROM invoice_revisions WHERE invoice_id = ?', [inv.id],
    );
    expect(snapRow.revision_number).toBe(1);
    const snap = typeof snapRow.snapshot_json === 'string' ? JSON.parse(snapRow.snapshot_json) : snapRow.snapshot_json;
    expect(snap.items[0].itemName).toBe('A');
    expect(snap.subtotal).toBe('100.00');
  });
```

- [ ] **Step 2: Run, expect fail**

```bash
npx jest src/invoices/invoices.service.spec.ts -t "edit after send"
```

Expected: FAIL with "Edit-after-send not implemented yet (Task 4.2)".

- [ ] **Step 3: Implement the corrected branch**

Replace the body of `update()` in `src/invoices/invoices.service.ts` with:

```typescript
  async update(id: number, dto: InvoiceDto, _userId: number): Promise<Invoice> {
    const settings = await this.settings.get();
    const totals = computeTotals(dto.items, settings.vatRate);
    const wordsDefault = amountInWords(totals.grandTotal, settings.currencyLabel);
    const words = dto.amountInWords?.trim() || wordsDefault;

    return this.ds.transaction(async (tx) => {
      const invRepo = tx.getRepository(Invoice);
      const itemRepo = tx.getRepository(InvoiceItem);
      const current = await invRepo.findOne({
        where: { id }, relations: ['items', 'customer'],
        order: { items: { sortOrder: 'ASC' } } as any,
      });
      if (!current) throw new NotFoundException(`Invoice ${id} not found`);

      const wasSent = current.status === 'sent' || current.status === 'corrected';

      if (wasSent) {
        // snapshot the current state into invoice_revisions
        const fileName = `${current.year}-${String(current.invoiceNumber).padStart(3, '0')}-r${current.revision}.pdf`;
        const pdfPath = `${this.config.get<string>('PDF_STORAGE_DIR')}/${fileName}`;
        await tx.query(
          `INSERT INTO invoice_revisions (invoice_id, revision_number, snapshot_json, pdf_path)
           VALUES (?, ?, ?, ?)`,
          [id, current.revision, JSON.stringify({
            invoiceNumber: current.invoiceNumber, year: current.year,
            customerId: current.customerId, invoiceDate: current.invoiceDate,
            subtotal: current.subtotal, vatRate: current.vatRate,
            vatAmount: current.vatAmount, grandTotal: current.grandTotal,
            amountInWords: current.amountInWords,
            items: current.items.map((i) => ({
              sortOrder: i.sortOrder, itemName: i.itemName, description: i.description,
              unitCost: i.unitCost, quantity: i.quantity, quantityNote: i.quantityNote,
              lineTotal: i.lineTotal,
            })),
          }), pdfPath],
        );
      }

      Object.assign(current, {
        customerId: dto.customerId,
        invoiceDate: dto.invoiceDate,
        subtotal: totals.subtotal,
        vatAmount: totals.vatAmount,
        grandTotal: totals.grandTotal,
        amountInWords: words,
        revision: wasSent ? current.revision + 1 : current.revision,
        status: wasSent ? 'corrected' : current.status,
      });
      await invRepo.save(current);

      await itemRepo.delete({ invoiceId: id });
      await itemRepo.save(dto.items.map((it, idx) => ({
        invoiceId: id, sortOrder: idx,
        itemName: it.itemName, description: it.description,
        unitCost: it.unitCost, quantity: it.quantity, quantityNote: it.quantityNote,
        lineTotal: computeLineTotal(it.unitCost, it.quantity),
      })));

      return invRepo.findOneOrFail({
        where: { id }, relations: ['items', 'customer'],
        order: { items: { sortOrder: 'ASC' } } as any,
      });
    });
  }
```

- [ ] **Step 4: Run, expect pass**

```bash
npx jest src/invoices/invoices.service.spec.ts
```

Expected: 4 PASS.

- [ ] **Step 5: Commit**

```bash
git add src/invoices/invoices.service.ts src/invoices/invoices.service.spec.ts
git commit -m "feat(invoices): edit-after-send creates revision snapshot, bumps revision, status=corrected"
```

---

### Task 4.3: E2E test — edit-after-send revision flow

**Files:**
- Create: `test/e2e/edit-revision.e2e-spec.ts`

- [ ] **Step 1: Test**

`test/e2e/edit-revision.e2e-spec.ts`:

```typescript
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { DataSource } from 'typeorm';
import { existsSync } from 'fs';
import { resolve } from 'path';
import { bootstrapTestApp, ensureUser, loginAndGetCookie } from './test-helpers';

describe('Invoice edit-after-send (e2e)', () => {
  let app: INestApplication;
  let cookie: string;
  let customerId: number;
  let invoiceId: number;
  const YEAR = new Date().getFullYear();

  beforeAll(async () => {
    app = await bootstrapTestApp();
    await ensureUser(app, 'admin-edit@aquester.com', 'pw1', 'admin');
    cookie = await loginAndGetCookie(app, 'admin-edit@aquester.com', 'pw1');
    const ds = app.get(DataSource);
    await ds.query('DELETE FROM invoice_items');
    await ds.query('DELETE FROM invoice_revisions');
    await ds.query('DELETE FROM email_logs');
    await ds.query('DELETE FROM invoices');
    await ds.query('DELETE FROM invoice_counters WHERE year = ?', [YEAR]);
    await ds.query('DELETE FROM customer_cc_emails');
    await ds.query('DELETE FROM customers');
    const r = await ds.query(`INSERT INTO customers(company_name,address,primary_email) VALUES('Acme','Kathmandu','a@x.com')`);
    customerId = r.insertId;

    const create = await request(app.getHttpServer())
      .post('/invoices/new').set('Cookie', cookie)
      .send({ customerId, invoiceDate: `${YEAR}-09-22`,
        items: [{ itemName: 'X', description: 'd', unitCost: '100', quantity: '1' }],
      }).expect(302);
    invoiceId = Number(create.headers.location.split('/').pop());

    // Mark sent (Phase 4 send flow comes in Task 4.5)
    await ds.query(`UPDATE invoices SET status='sent', sent_at = NOW() WHERE id = ?`, [invoiceId]);
  });

  afterAll(async () => { await app.close(); });

  it('editing a sent invoice creates a revision row, bumps revision, status=corrected, new PDF on disk', async () => {
    await request(app.getHttpServer())
      .post(`/invoices/${invoiceId}/edit`).set('Cookie', cookie)
      .send({ customerId, invoiceDate: `${YEAR}-09-23`,
        items: [{ itemName: 'X-fix', description: 'd', unitCost: '120', quantity: '1' }],
      }).expect(302);

    const ds = app.get(DataSource);
    const [inv] = await ds.query('SELECT status, revision, subtotal FROM invoices WHERE id = ?', [invoiceId]);
    expect(inv.status).toBe('corrected');
    expect(inv.revision).toBe(2);
    expect(inv.subtotal).toBe('120.00');

    const [{ c }] = await ds.query('SELECT count(*) c FROM invoice_revisions WHERE invoice_id = ?', [invoiceId]);
    expect(Number(c)).toBe(1);

    const r2 = resolve(process.env.PDF_STORAGE_DIR || './storage/invoices', `${YEAR}-001-r2.pdf`);
    const r1 = resolve(process.env.PDF_STORAGE_DIR || './storage/invoices', `${YEAR}-001-r1.pdf`);
    expect(existsSync(r1)).toBe(true);
    expect(existsSync(r2)).toBe(true);
  }, 60_000);
});
```

- [ ] **Step 2: Run, expect pass**

```bash
npm run test:e2e -- edit-revision
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add test/e2e/edit-revision.e2e-spec.ts
git commit -m "test(invoices): e2e for edit-after-send revision flow"
```

---

### Task 4.4: Mail service — Nodemailer wrapper

**Files:**
- Create: `src/mail/mail.module.ts`, `src/mail/mail.service.ts`, `src/mail/mail.service.spec.ts`, `src/mail/dto/send-email.dto.ts`
- Modify: `src/app.module.ts`

- [ ] **Step 1: DTO**

`src/mail/dto/send-email.dto.ts`:

```typescript
import { Transform } from 'class-transformer';
import { ArrayUnique, IsArray, IsEmail, IsOptional, IsString, MaxLength } from 'class-validator';

export class SendEmailDto {
  @IsString() @MaxLength(512) subject!: string;
  @IsString() @MaxLength(20_000) bodyHtml!: string;

  @Transform(({ value }) => {
    if (Array.isArray(value)) return value;
    if (typeof value !== 'string') return [];
    return value.split(/[\n,]/).map((e) => e.trim()).filter(Boolean);
  })
  @IsArray() @ArrayUnique() @IsEmail({}, { each: true })
  ccEmails!: string[];
}
```

- [ ] **Step 2: Failing test**

`src/mail/mail.service.spec.ts`:

```typescript
import { MailService } from './mail.service';

describe('MailService', () => {
  it('builds the default subject for a normal invoice', () => {
    const svc = new MailService({ get: () => 'irrelevant' } as any);
    expect(svc.buildSubject({ invoiceNumber: 7, status: 'draft' } as any))
      .toBe('Invoice #007 from Aquester Solutions Pvt. Ltd.');
  });

  it('builds the default subject for a corrected invoice', () => {
    const svc = new MailService({ get: () => 'irrelevant' } as any);
    expect(svc.buildSubject({ invoiceNumber: 7, status: 'corrected' } as any))
      .toBe('Corrected invoice #007 from Aquester Solutions Pvt. Ltd.');
  });

  it('builds a body that mentions the invoice number and total', () => {
    const svc = new MailService({ get: () => 'irrelevant' } as any);
    const body = svc.buildBody({ invoiceNumber: 7, status: 'sent', grandTotal: '1234.56' } as any);
    expect(body).toContain('#007');
    expect(body).toContain('1,234.56');
    expect(body).toContain('attached');
  });

  it('appends a correction notice for corrected invoices', () => {
    const svc = new MailService({ get: () => 'x' } as any);
    const body = svc.buildBody({ invoiceNumber: 7, status: 'corrected', grandTotal: '1.00' } as any);
    expect(body).toContain('previous invoice');
    expect(body).toContain('discard');
  });
});
```

- [ ] **Step 3: Run, expect fail**

```bash
npx jest src/mail/mail.service.spec.ts
```

Expected: FAIL.

- [ ] **Step 4: Implement service + module**

`src/mail/mail.service.ts`:

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { Invoice } from '../entities/invoice.entity';

@Injectable()
export class MailService {
  private readonly log = new Logger(MailService.name);
  private transporter?: nodemailer.Transporter;

  constructor(private readonly config: ConfigService) {}

  private getTransporter(): nodemailer.Transporter {
    if (!this.transporter) {
      this.transporter = nodemailer.createTransport({
        host: this.config.get<string>('SMTP_HOST'),
        port: Number(this.config.get<string>('SMTP_PORT')),
        secure: Number(this.config.get<string>('SMTP_PORT')) === 465,
        auth: {
          user: this.config.get<string>('SMTP_USER'),
          pass: this.config.get<string>('SMTP_PASS'),
        },
      });
    }
    return this.transporter;
  }

  buildSubject(invoice: Pick<Invoice, 'invoiceNumber' | 'status'>): string {
    const num = String(invoice.invoiceNumber).padStart(3, '0');
    const prefix = invoice.status === 'corrected' ? 'Corrected invoice' : 'Invoice';
    return `${prefix} #${num} from Aquester Solutions Pvt. Ltd.`;
  }

  buildBody(invoice: Pick<Invoice, 'invoiceNumber' | 'status' | 'grandTotal'>): string {
    const num = String(invoice.invoiceNumber).padStart(3, '0');
    const total = Number(invoice.grandTotal).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const correction = invoice.status === 'corrected'
      ? `<p><em>We found an error on the previous invoice. Please find the corrected version attached and discard the earlier copy.</em></p>`
      : '';
    return `
      <p>Dear customer,</p>
      ${correction}
      <p>Please find attached invoice <strong>#${num}</strong> for a total of <strong>${total}</strong>.</p>
      <p>Thank you for your business.</p>
      <p>—<br/>Aquester Solutions Pvt. Ltd.</p>
    `.trim();
  }

  async send(opts: {
    to: string; cc: string[]; subject: string; html: string;
    attachment: { filename: string; content: Buffer };
  }): Promise<void> {
    const tx = this.getTransporter();
    await tx.sendMail({
      from: this.config.get<string>('SMTP_FROM'),
      to: opts.to,
      cc: opts.cc.length ? opts.cc : undefined,
      subject: opts.subject,
      html: opts.html,
      attachments: [{ filename: opts.attachment.filename, content: opts.attachment.content }],
    });
  }
}
```

`src/mail/mail.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { MailService } from './mail.service';

@Module({ providers: [MailService], exports: [MailService] })
export class MailModule {}
```

Add `MailModule` to `src/app.module.ts` `imports`.

- [ ] **Step 5: Run, expect pass**

```bash
npx jest src/mail/mail.service.spec.ts
```

Expected: 4 PASS.

- [ ] **Step 6: Commit**

```bash
git add src/mail/ src/app.module.ts
git commit -m "feat(mail): MailService with subject/body builders + Nodemailer transport"
```

---

### Task 4.5: Email preview & send page

**Files:**
- Create: `src/mail/mail.controller.ts`, `views/pages/invoices/email.hbs`
- Modify: `src/mail/mail.module.ts`, `src/invoices/invoices.module.ts` (export `InvoicesService`)

- [ ] **Step 1: Make `InvoicesService` & `CustomersService` available to MailModule**

In `src/invoices/invoices.module.ts`, add `InvoicesService` to `exports`. In `src/customers/customers.module.ts` it's already exported.

- [ ] **Step 2: Mail controller**

`src/mail/mail.controller.ts`:

```typescript
import {
  BadRequestException, Body, Controller, Get, Param, ParseIntPipe, Post, Render, Res,
} from '@nestjs/common';
import { Response } from 'express';
import { DataSource } from 'typeorm';
import { InjectDataSource } from '@nestjs/typeorm';
import { MailService } from './mail.service';
import { SendEmailDto } from './dto/send-email.dto';
import { InvoicesService } from '../invoices/invoices.service';
import { CustomersService } from '../customers/customers.service';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';

@Controller('invoices/:id/email')
@Roles('admin')
export class MailController {
  constructor(
    private readonly mail: MailService,
    private readonly invoices: InvoicesService,
    private readonly customers: CustomersService,
    @InjectDataSource() private readonly ds: DataSource,
  ) {}

  @Get() @Render('pages/invoices/email')
  async preview(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthUser,
  ) {
    const invoice = await this.invoices.findOne(id);
    const customer = await this.customers.findOne(invoice.customerId);
    return {
      title: 'Email invoice', layout: 'layouts/main', user, isAdmin: true,
      invoice,
      to: customer.primaryEmail,
      ccText: customer.ccEmails.map((e) => e.email).join('\n'),
      subject: this.mail.buildSubject(invoice),
      bodyHtml: this.mail.buildBody(invoice),
    };
  }

  @Post()
  async send(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SendEmailDto,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ) {
    const invoice = await this.invoices.findOne(id);
    const customer = await this.customers.findOne(invoice.customerId);

    let buffer: Buffer; let fileName: string;
    try {
      const r = await this.invoices.renderPdf(id);
      buffer = r.buffer; fileName = r.fileName;
    } catch (e: any) {
      return res.render('pages/invoices/email', {
        title: 'Email invoice', layout: 'layouts/main', user, isAdmin: true,
        invoice, to: customer.primaryEmail, ccText: dto.ccEmails.join('\n'),
        subject: dto.subject, bodyHtml: dto.bodyHtml,
        error: `PDF generation failed: ${e?.message || e}`,
      });
    }

    try {
      await this.mail.send({
        to: customer.primaryEmail,
        cc: dto.ccEmails,
        subject: dto.subject,
        html: dto.bodyHtml,
        attachment: { filename: fileName, content: buffer },
      });
    } catch (e: any) {
      return res.render('pages/invoices/email', {
        title: 'Email invoice', layout: 'layouts/main', user, isAdmin: true,
        invoice, to: customer.primaryEmail, ccText: dto.ccEmails.join('\n'),
        subject: dto.subject, bodyHtml: dto.bodyHtml,
        error: `SMTP error: ${e?.message || e}`,
      });
    }

    // Log + flip status
    await this.ds.transaction(async (tx) => {
      await tx.query(
        `INSERT INTO email_logs (invoice_id, to_email, cc_emails_json, subject, body_html, sent_by)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [id, customer.primaryEmail, JSON.stringify(dto.ccEmails), dto.subject, dto.bodyHtml, user.id],
      );
      if (invoice.status === 'draft') {
        await tx.query(`UPDATE invoices SET status = 'sent', sent_at = NOW() WHERE id = ?`, [id]);
      }
    });

    return res.redirect(`/invoices/${id}`);
  }
}
```

Add `controllers: [MailController]` and `imports: [InvoicesModule, CustomersModule]` to `MailModule`. Add the relevant `import { InvoicesModule } from '../invoices/invoices.module'` and `CustomersModule`.

- [ ] **Step 3: View**

`views/pages/invoices/email.hbs`:

```handlebars
<h1>Email invoice {{invoice.invoiceNumber}}</h1>
{{#if error}}<div class="flash error">{{error}}</div>{{/if}}
<form method="post" action="/invoices/{{invoice.id}}/email" style="max-width:720px">
  <label>To (locked to customer's primary email)</label>
  <input value="{{to}}" disabled/>
  <label>CC (one per line)</label>
  <textarea name="ccEmails" rows="3">{{ccText}}</textarea>
  <label>Subject</label>
  <input name="subject" value="{{subject}}" required/>
  <label>Body (HTML)</label>
  <textarea name="bodyHtml" rows="10" required>{{bodyHtml}}</textarea>
  <details style="margin:1rem 0">
    <summary>Preview</summary>
    <div style="border:1px solid #ddd; padding:1rem">{{{bodyHtml}}}</div>
  </details>
  <button type="submit" class="primary">Send</button>
</form>
```

- [ ] **Step 4: Manual verify (only if SMTP creds are filled in)**

Without real SMTP creds the send will fail with a clear flash error — that's fine for now; the page round-trip is what we're testing manually. To send for real: drop a Gmail App Password into `.env` `SMTP_PASS`, restart the app, and click Send.

- [ ] **Step 5: Commit**

```bash
git add src/mail/ src/invoices/invoices.module.ts views/pages/invoices/email.hbs
git commit -m "feat(mail): email preview + send page (subject/CC editable, PDF attached)"
```

---

### Task 4.6: E2E test — email send (mocked transport)

**Files:**
- Create: `test/e2e/email.e2e-spec.ts`

We override the `MailService` provider with a stub so we don't actually hit SMTP.

- [ ] **Step 1: Test**

`test/e2e/email.e2e-spec.ts`:

```typescript
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { DataSource } from 'typeorm';
import { join } from 'path';
import * as cookieParser from 'cookie-parser';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from '../../src/app.module';
import { MailService } from '../../src/mail/mail.service';
import { ensureUser, loginAndGetCookie } from './test-helpers';

describe('Email (e2e, mocked SMTP)', () => {
  let app: INestApplication;
  let cookie: string;
  let customerId: number;
  let invoiceId: number;
  const sent: any[] = [];
  const YEAR = new Date().getFullYear();

  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(MailService)
      .useValue({
        buildSubject: (inv: any) => `Invoice #${String(inv.invoiceNumber).padStart(3,'0')} from Aquester Solutions Pvt. Ltd.`,
        buildBody: (inv: any) => `<p>#${String(inv.invoiceNumber).padStart(3,'0')}</p>`,
        send: async (opts: any) => { sent.push(opts); },
      })
      .compile();
    app = mod.createNestApplication<NestExpressApplication>();
    app.useStaticAssets(join(__dirname, '..', '..', 'public'), { prefix: '/public/' });
    app.setBaseViewsDir(join(__dirname, '..', '..', 'views'));
    app.setViewEngine('hbs');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const hbs = require('hbs');
    hbs.registerPartials(join(__dirname, '..', '..', 'views', 'partials'));
    hbs.registerHelper('numFmt', (v: any) => Number(v).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
    hbs.registerHelper('nl2br', (s: string) => (s ?? '').toString().replace(/\n/g, '<br>'));
    hbs.registerHelper('json', (v: unknown) => new (require('hbs')).SafeString(JSON.stringify(v ?? null)));
    hbs.registerHelper('eq', (a: unknown, b: unknown) => String(a) === String(b));
    hbs.registerHelper('padNum', (n: number) => String(n).padStart(3, '0'));
    app.use(cookieParser());
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
    await app.init();

    await ensureUser(app, 'admin-mail@aquester.com', 'pw1', 'admin');
    cookie = await loginAndGetCookie(app, 'admin-mail@aquester.com', 'pw1');

    const ds = app.get(DataSource);
    await ds.query('DELETE FROM invoice_items');
    await ds.query('DELETE FROM email_logs');
    await ds.query('DELETE FROM invoice_revisions');
    await ds.query('DELETE FROM invoices');
    await ds.query('DELETE FROM invoice_counters WHERE year = ?', [YEAR]);
    await ds.query('DELETE FROM customer_cc_emails');
    await ds.query('DELETE FROM customers');
    const r = await ds.query(`INSERT INTO customers(company_name,address,primary_email) VALUES('Acme','Kathmandu','to@example.com')`);
    customerId = r.insertId;

    const create = await request(app.getHttpServer())
      .post('/invoices/new').set('Cookie', cookie)
      .send({ customerId, invoiceDate: `${YEAR}-09-22`,
        items: [{ itemName: 'X', description: 'd', unitCost: '100', quantity: '1' }],
      }).expect(302);
    invoiceId = Number(create.headers.location.split('/').pop());
  });

  afterAll(async () => { await app.close(); });

  it('send writes an email_log row, flips status to sent, calls transport with attachment', async () => {
    await request(app.getHttpServer())
      .post(`/invoices/${invoiceId}/email`).set('Cookie', cookie)
      .send({
        subject: `Invoice #001 from Aquester Solutions Pvt. Ltd.`,
        bodyHtml: '<p>hi</p>',
        ccEmails: 'cc1@example.com,cc2@example.com',
      }).expect(302);

    expect(sent.length).toBe(1);
    expect(sent[0].to).toBe('to@example.com');
    expect(sent[0].cc).toEqual(['cc1@example.com', 'cc2@example.com']);
    expect(sent[0].attachment.filename).toMatch(/-r1\.pdf$/);
    expect(sent[0].attachment.content.slice(0,4).toString()).toBe('%PDF');

    const ds = app.get(DataSource);
    const [inv] = await ds.query('SELECT status, sent_at FROM invoices WHERE id = ?', [invoiceId]);
    expect(inv.status).toBe('sent');
    expect(inv.sent_at).not.toBeNull();
    const [{ c }] = await ds.query('SELECT count(*) c FROM email_logs WHERE invoice_id = ?', [invoiceId]);
    expect(Number(c)).toBe(1);
  }, 60_000);
});
```

- [ ] **Step 2: Run, expect pass**

```bash
npm run test:e2e -- email
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add test/e2e/email.e2e-spec.ts
git commit -m "test(mail): e2e for send (mocked transport, asserts attachment + status flip)"
```

---

### Task 4.7: Users module (admin manages user accounts)

**Files:**
- Create: `src/users/users.module.ts`, `src/users/users.controller.ts`, `src/users/users.service.ts`, `src/users/dto/{create-user.dto.ts,update-user.dto.ts}`, `views/pages/users/{list,form}.hbs`
- Modify: `src/app.module.ts`

- [ ] **Step 1: Service**

`src/users/users.service.ts`:

```typescript
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserRole } from '../entities/user.entity';
import { hashPassword } from '../auth/bcrypt.helper';

@Injectable()
export class UsersService {
  constructor(@InjectRepository(User) private readonly repo: Repository<User>) {}

  list() { return this.repo.find({ order: { email: 'ASC' } }); }

  async findOne(id: number): Promise<User> {
    const u = await this.repo.findOne({ where: { id } });
    if (!u) throw new NotFoundException(`User ${id} not found`);
    return u;
  }

  async create(email: string, password: string, role: UserRole): Promise<User> {
    const passwordHash = await hashPassword(password);
    return this.repo.save(this.repo.create({ email, passwordHash, role }));
  }

  async update(id: number, fields: { email: string; role: UserRole; password?: string }): Promise<User> {
    const u = await this.findOne(id);
    u.email = fields.email; u.role = fields.role;
    if (fields.password) u.passwordHash = await hashPassword(fields.password);
    return this.repo.save(u);
  }
}
```

`src/users/dto/create-user.dto.ts`:

```typescript
import { IsEmail, IsIn, IsString, MinLength } from 'class-validator';

export class CreateUserDto {
  @IsEmail() email!: string;
  @IsString() @MinLength(6) password!: string;
  @IsIn(['admin', 'viewer']) role!: 'admin' | 'viewer';
}
```

`src/users/dto/update-user.dto.ts`:

```typescript
import { IsEmail, IsIn, IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateUserDto {
  @IsEmail() email!: string;
  @IsIn(['admin', 'viewer']) role!: 'admin' | 'viewer';
  @IsOptional() @IsString() @MinLength(6) password?: string;
}
```

- [ ] **Step 2: Controller**

`src/users/users.controller.ts`:

```typescript
import {
  Body, Controller, Get, Param, ParseIntPipe, Post, Render, Res,
} from '@nestjs/common';
import { Response } from 'express';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';

@Controller('users')
@Roles('admin')
export class UsersController {
  constructor(private readonly svc: UsersService) {}

  @Get() @Render('pages/users/list')
  async list(@CurrentUser() user: AuthUser) {
    const users = await this.svc.list();
    return { title: 'Users', layout: 'layouts/main', user, isAdmin: true, users };
  }

  @Get('new') @Render('pages/users/form')
  newForm(@CurrentUser() user: AuthUser) {
    return {
      title: 'New user', layout: 'layouts/main', user, isAdmin: true,
      action: '/users/new', target: { email: '', role: 'viewer' }, isCreate: true,
    };
  }

  @Post('new')
  async create(@Body() dto: CreateUserDto, @Res() res: Response) {
    await this.svc.create(dto.email, dto.password, dto.role);
    return res.redirect('/users');
  }

  @Get(':id/edit') @Render('pages/users/form')
  async editForm(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthUser) {
    const target = await this.svc.findOne(id);
    return {
      title: `Edit ${target.email}`, layout: 'layouts/main', user, isAdmin: true,
      action: `/users/${id}/edit`, target, isCreate: false,
    };
  }

  @Post(':id/edit')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateUserDto,
    @Res() res: Response,
  ) {
    await this.svc.update(id, dto);
    return res.redirect('/users');
  }
}
```

`src/users/users.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../entities/user.entity';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';

@Module({
  imports: [TypeOrmModule.forFeature([User])],
  providers: [UsersService],
  controllers: [UsersController],
})
export class UsersModule {}
```

Add `UsersModule` to `src/app.module.ts` `imports`.

- [ ] **Step 3: Views**

`views/pages/users/list.hbs`:

```handlebars
<div style="display:flex; justify-content:space-between; align-items:center;">
  <h1>Users</h1>
  <a href="/users/new" class="primary" style="padding:0.5rem 0.9rem; background:#c69214; color:#fff; border-radius:4px; text-decoration:none;">+ New user</a>
</div>
<table>
  <thead><tr><th>Email</th><th>Role</th><th></th></tr></thead>
  <tbody>
    {{#each users}}
      <tr><td>{{this.email}}</td><td>{{this.role}}</td><td><a href="/users/{{this.id}}/edit">Edit</a></td></tr>
    {{/each}}
  </tbody>
</table>
```

`views/pages/users/form.hbs`:

```handlebars
<h1>{{title}}</h1>
<form method="post" action="{{action}}" style="max-width:480px">
  <label>Email</label>
  <input type="email" name="email" value="{{target.email}}" required/>
  <label>Role</label>
  <select name="role" required>
    <option value="admin"  {{#if (eq target.role 'admin')}}selected{{/if}}>admin</option>
    <option value="viewer" {{#if (eq target.role 'viewer')}}selected{{/if}}>viewer</option>
  </select>
  <label>{{#if isCreate}}Password{{else}}New password (leave blank to keep){{/if}}</label>
  <input type="password" name="password" {{#if isCreate}}required minlength="6"{{/if}}/>
  <button type="submit" class="primary" style="margin-top:1rem">Save</button>
</form>
```

- [ ] **Step 4: Manual verify**

Boot. Login as admin → `/users` → create a viewer account → log out → log in as viewer → confirm `/customers` works, `/users` returns 403.

- [ ] **Step 5: Commit**

```bash
git add src/users/ src/app.module.ts views/pages/users/
git commit -m "feat(users): admin can create/edit user accounts"
```

---

### Task 4.8: Error pages (403/404/500)

**Files:**
- Create: `src/common/filters/http-exception.filter.ts`, `views/pages/errors/{403,404,500}.hbs`
- Modify: `src/main.ts`

- [ ] **Step 1: Filter**

`src/common/filters/http-exception.filter.ts`:

```typescript
import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly log = new Logger('HttpExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res: Response = ctx.getResponse();
    const req: Request = ctx.getRequest();
    const user = (req as any).user;

    let status = 500;
    let template = 'pages/errors/500';
    if (exception instanceof HttpException) {
      status = exception.getStatus();
      if (status === 403) template = 'pages/errors/403';
      else if (status === 404) template = 'pages/errors/404';
      else if (status >= 500) template = 'pages/errors/500';
      else { return res.status(status).send(exception.message); }
    } else {
      this.log.error(exception);
    }

    return res.status(status).render(template, {
      title: `Error ${status}`, layout: 'layouts/main', user, isAdmin: user?.role === 'admin',
    });
  }
}
```

- [ ] **Step 2: Wire filter globally**

In `src/main.ts`, after `app.useGlobalPipes(...)`:

```typescript
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
app.useGlobalFilters(new HttpExceptionFilter());
```

- [ ] **Step 3: Templates**

`views/pages/errors/403.hbs`:

```handlebars
<h1>403 — Forbidden</h1>
<p>You don't have permission to view this page.</p>
<p><a href="/">Back to dashboard</a></p>
```

`views/pages/errors/404.hbs`:

```handlebars
<h1>404 — Not found</h1>
<p>That page doesn't exist.</p>
<p><a href="/">Back to dashboard</a></p>
```

`views/pages/errors/500.hbs`:

```handlebars
<h1>500 — Something went wrong</h1>
<p>An unexpected error occurred. Check the server logs for details.</p>
<p><a href="/">Back to dashboard</a></p>
```

- [ ] **Step 4: Update existing E2E test expectations**

The viewer-403 test in `customers.e2e-spec.ts` already expects 403 — confirm it still passes:

```bash
npm run test:e2e -- customers
```

Expected: 4 PASS. The response body now also contains "Forbidden" — existing assertions still work since they only check status.

- [ ] **Step 5: Commit**

```bash
git add src/common/filters/ src/main.ts views/pages/errors/
git commit -m "feat(errors): 403/404/500 hbs pages via global exception filter"
```

---

### Task 4.9: Dashboard with recent invoices

**Files:**
- Modify: `src/app.controller.ts`, `views/pages/dashboard.hbs`, `src/app.module.ts`

- [ ] **Step 1: Inject InvoicesService into AppController**

Replace `src/app.controller.ts`:

```typescript
import { Controller, Get, Render } from '@nestjs/common';
import { CurrentUser, AuthUser } from './common/decorators/current-user.decorator';
import { InvoicesService } from './invoices/invoices.service';

@Controller()
export class AppController {
  constructor(private readonly invoices: InvoicesService) {}

  @Get() @Render('pages/dashboard')
  async dashboard(@CurrentUser() user: AuthUser) {
    const recent = (await this.invoices.list({})).slice(0, 10);
    return {
      title: 'Dashboard', layout: 'layouts/main',
      user, isAdmin: user.role === 'admin', recent,
    };
  }
}
```

In `src/app.module.ts`, ensure `InvoicesModule` is imported (it is, from Phase 3) so `AppController` can resolve `InvoicesService`.

- [ ] **Step 2: Update dashboard template**

`views/pages/dashboard.hbs`:

```handlebars
<h1>Dashboard</h1>
<p>Welcome, {{user.email}} ({{user.role}}).</p>

<h2>Recent invoices</h2>
<table>
  <thead><tr><th>#</th><th>Date</th><th>Customer</th><th>Total</th><th>Status</th></tr></thead>
  <tbody>
    {{#each recent}}
      <tr>
        <td><a href="/invoices/{{this.id}}">{{this.year}}-{{padNum this.invoiceNumber}}</a></td>
        <td>{{this.invoiceDate}}</td>
        <td>{{this.customer.companyName}}</td>
        <td>{{numFmt this.grandTotal}}</td>
        <td>{{this.status}}</td>
      </tr>
    {{else}}<tr><td colspan="5">No invoices yet. <a href="/invoices/new">Create one</a></td></tr>{{/each}}
  </tbody>
</table>
```

- [ ] **Step 3: Manual verify**

Boot, login, dashboard shows up to 10 most recent invoices.

- [ ] **Step 4: Commit**

```bash
git add src/app.controller.ts views/pages/dashboard.hbs
git commit -m "feat(dashboard): show 10 most recent invoices"
```

---

### Task 4.10: README

**Files:**
- Create: `README.md`

- [ ] **Step 1: Write README**

`README.md`:

```markdown
# Aquester Invoice

Server-rendered invoicing tool for Aquester Solutions Pvt. Ltd. — manages customers, generates pixel-perfect PDF invoices, and emails them via Gmail SMTP.

## Stack

NestJS · TypeORM · MySQL · Handlebars · Alpine.js · Puppeteer · Nodemailer · JWT-in-cookie auth.

## Local setup

1. **Install MySQL** locally and create the database:

   ```bash
   mysql -uroot -p -e "CREATE DATABASE aquester_invoice CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
   ```

2. **Clone & install**:

   ```bash
   git clone https://github.com/wupendra/invoice-system.git
   cd invoice-system
   npm install
   ```

3. **Configure env**:

   ```bash
   cp .env.example .env
   # edit .env: DB_USER, DB_PASS, JWT_SECRET, SMTP_PASS (Gmail App Password)
   ```

4. **Run migrations** (creates schema, seeds default settings + admin user):

   ```bash
   npm run migration:run
   ```

   Default admin login: `kamal@aquester.com` / `changeme` — change the password in `/users` after first login.

5. **Start the app**:

   ```bash
   npm run start:dev
   # → http://localhost:3000
   ```

## Tests

```bash
npm test            # unit tests
npm run test:e2e    # end-to-end tests (requires the local DB to be running)
```

## Project layout

See `docs/superpowers/specs/2026-04-16-aquester-invoice-design.md` for the full design and `docs/superpowers/plans/2026-04-16-aquester-invoice.md` for the implementation plan.

## Operating notes

- **Reset invoice counter:** `/settings/counter` (admin only). Click *Reset to 0* at year-end so the next invoice claims `001`.
- **Edit a sent invoice:** opening `/invoices/:id/edit` after the customer has received the PDF will create a new revision (the original PDF stays on disk in `storage/invoices/`) and switch the status to `corrected`. Re-emailing it sends the corrected PDF with a "discard the earlier copy" notice.
- **Configure company info:** `/settings` (admin only) — VAT rate, currency label, FROM-block, bank details, and footer contact person.
- **Gmail SMTP:** the app uses Nodemailer with Gmail's SMTP. You need a Google App Password (regular passwords don't work). Generate at https://myaccount.google.com/apppasswords and put it in `SMTP_PASS`.
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: README with setup, tests, and operating notes"
```

---

### Task 4.11: Final smoke + push

- [ ] **Step 1: Full test pass**

```bash
npm test
npm run test:e2e
```

Expected: all green.

- [ ] **Step 2: Manual end-to-end**

```bash
npm run start:dev
```

  1. Login as admin
  2. Edit `/settings` (no-op save)
  3. Create a customer
  4. Create an invoice with two line items including a `quantityNote`
  5. Download the PDF — visually compare against the supplied Aquester example
  6. Edit the invoice, change a quantity, save — PDF regenerates
  7. Mark sent (manually flip status in DB or send a real email if SMTP is configured)
  8. Edit the invoice again — confirm status becomes `corrected`, revision = 2, both PDF revisions exist on disk
  9. `/settings/counter` → reset
  10. Logout, login as viewer (created via `/users`), confirm read-only access

- [ ] **Step 3: Push**

```bash
git push
```

Phase 4 done. The system is feature-complete.

---

# Self-review notes

After writing this plan, I checked it against the spec and made the following alignments:

- **Counter reset is current-year only** (spec §6.4) — Task 3.5's controller hardcodes `new Date().getFullYear()`.
- **Invoice number/year are immutable on edit** (spec §6.2) — Task 4.1's `update()` only touches mutable fields; `invoiceNumber`, `year`, and `revision` are managed by the service, never by the DTO.
- **`sent_at` reflects only the first send** (spec §6.3 step 7) — Task 4.5's send handler only updates `status`/`sent_at` when the invoice was `draft`. Subsequent sends append to `email_logs` only.
- **First-invoice-of-year counter row** (spec §6.1) — Task 3.4's `claimNext` does an `INSERT` then re-locks if the row is missing.
- **Editable fields on edit** (spec §6.2) — covered by `InvoiceDto` (customer, date, items, amount-in-words).
- **Correction notice on PDF & in email** (spec §6.3 / §7) — Task 3.8's PDF template renders the yellow "correction notice" band when `status === 'corrected'`; Task 4.4's `buildBody()` includes the discard-the-earlier-copy paragraph.

No `TBD`/`TODO`/"add appropriate validation" placeholders remain. Method names are stable across tasks (`claimNext`, `getCurrent`, `reset`, `create`, `update`, `findOne`, `list`, `renderPdf`, `buildSubject`, `buildBody`, `send`).



