# Aquester Invoice

Server-rendered invoicing tool for Aquester Solutions Pvt. Ltd. — manages customers, generates pixel-perfect PDF invoices, and emails them via Gmail SMTP.

## Stack

NestJS · TypeORM · MySQL · Handlebars · Alpine.js · Puppeteer · Nodemailer · JWT-in-cookie auth.

## Local setup

1. **Install MySQL** locally and create the database:

   ```bash
   mysql -uroot -h127.0.0.1 -e "CREATE DATABASE aquester_invoice CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
   ```

2. **Clone & install**:

   ```bash
   git clone https://github.com/wupendra/invoice-system.git
   cd invoice-system
   npm install
   ```

3. **Install Puppeteer's Chromium** (skipped during the initial npm install):

   ```bash
   npx puppeteer browsers install chrome
   ```

4. **Configure env**:

   ```bash
   cp .env.example .env
   # edit .env: DB_USER, DB_PASS, JWT_SECRET, SMTP_PASS (Gmail App Password)
   ```

5. **Run migrations** (creates schema, seeds default settings + admin user):

   ```bash
   npm run migration:run
   ```

   Default admin login: `kamal@aquester.com` / `changeme` — change the password in `/users` after first login.

6. **Drop in the real logo** at `public/logo.png` (the scaffold ships with a placeholder).

7. **Start the app**:

   ```bash
   npm run start:dev
   # → http://localhost:3000
   ```

## Tests

```bash
npm test            # unit tests
npm run test:e2e    # end-to-end tests (requires the local DB to be running)
```

The e2e suite includes Puppeteer-driven UI tests for the invoice form (live totals, add/remove row) so Chromium must be installed (Step 3 above).

## Project layout

- `src/auth/` — JWT-in-cookie auth + guards
- `src/users/` — admin user management
- `src/customers/` — customer CRUD with CC-email subresource
- `src/invoices/` — invoice create/edit (with revision-on-edit-after-send), PDF render
- `src/pdf/` — Puppeteer wrapper
- `src/mail/` — Nodemailer + email preview/send
- `src/counters/` — per-year invoice counter (manual reset)
- `src/settings/` — company settings (VAT rate, from-block, bank details, contact)
- `views/` — Handlebars templates (pages + the invoice PDF template reused by the PDF service)
- `public/` — logo, CSS, vendored Alpine.js bundle
- `storage/invoices/` — generated PDFs (git-ignored)

Spec: `docs/superpowers/specs/2026-04-16-aquester-invoice-design.md`
Implementation plan: `docs/superpowers/plans/2026-04-16-aquester-invoice.md`

## Operating notes

- **Reset invoice counter:** `/settings/counter` (admin only). Click *Reset to 0* at year-end so the next invoice claims `001`.
- **Edit a sent invoice:** opening `/invoices/:uuid/edit` after the customer has received the PDF creates a new revision — the original PDF stays on disk in `storage/invoices/`, a new PDF is generated with a correction notice banner, and the invoice status becomes `corrected`. Re-emailing sends the corrected PDF.
- **Configure company info:** `/settings` (admin only) — VAT rate, currency label, FROM-block, bank details, and footer contact person.
- **Gmail SMTP:** the app uses Nodemailer with Gmail's SMTP. You need a Google App Password (regular passwords don't work). Generate at https://myaccount.google.com/apppasswords and put it in `SMTP_PASS`.
- **URLs use UUIDs:** `/invoices/<uuid>` so invoice numbers aren't guessable from the URL.
