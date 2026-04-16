# Aquester Invoice — Design Spec

**Date:** 2026-04-16
**Owner:** Kamal Raj Silwal (kamal@aquester.com)
**Repo:** https://github.com/wupendra/invoice-system

## 1. Purpose

A small in-house invoicing tool for Aquester Solutions Pvt. Ltd. Manages a customer database, generates invoices in a fixed PDF layout (matching the existing Aquester invoice template), and emails them to customers via Gmail SMTP. Single-tenant, runs locally for now.

## 2. Stack

- **NestJS** (TypeScript) — single monolithic app
- **TypeORM + MySQL** — persistence with checked-in migrations
- **Handlebars** — server-rendered HTML templates (`views/`); the same invoice template is reused as the PDF source
- **Alpine.js** — light client-side interactivity for dynamic invoice line items
- **Puppeteer** — headless Chromium renders the Handlebars invoice template to PDF
- **Nodemailer** — Gmail SMTP using an App Password from `.env`
- **Passport-JWT in `httpOnly` cookie** — server-side auth for the rendered pages
- **class-validator** — DTO validation on every form
- **Jest + Supertest** — unit and E2E tests

Single repo, single process. Runs locally with `npm run start:dev` against a local MySQL.

## 3. Directory layout

```
src/
  auth/            login, JWT issue/verify, cookie handling, guards
  users/           user accounts (admin/viewer roles)
  customers/       CRUD + CC-emails subresource
  invoices/        CRUD + actions (preview, PDF, email, reset counter)
  pdf/             Puppeteer wrapper
  mail/            Nodemailer wrapper, email preview/send
  settings/        single-row settings (admin only)
  common/          guards, decorators, money/words helpers
views/             Handlebars templates (pages + invoice PDF template)
public/            logo, CSS, Alpine.js bundle
storage/invoices/  generated PDFs (git-ignored)
migrations/        TypeORM migrations
```

## 4. Data model

All tables MySQL, InnoDB, UTF-8.

### users
- `id` PK
- `email` unique
- `password_hash`
- `role` enum(`admin`, `viewer`)
- `created_at`

### customers
- `id` PK
- `company_name`
- `registration_number` (PAN/VAT no.)
- `address` (multi-line text)
- `primary_email`
- `phone`
- `notes` (internal-only, free text)
- `created_at`, `updated_at`

### customer_cc_emails
- `id` PK
- `customer_id` FK → customers
- `email`

### invoices
- `id` PK
- `invoice_number` (integer, padded to 3 digits in display)
- `year` (integer; combined with `invoice_number` is unique)
- `customer_id` FK → customers
- `invoice_date` (date)
- `subtotal`, `vat_rate`, `vat_amount`, `grand_total` (decimal(12,2))
- `amount_in_words` (text, editable by admin)
- `status` enum(`draft`, `sent`, `corrected`)
- `sent_at` (datetime, nullable)
- `revision` (int, starts at 1)
- `created_by` FK → users
- `created_at`, `updated_at`

### invoice_items
- `id` PK
- `invoice_id` FK → invoices (cascade delete)
- `sort_order` (int)
- `item_name`
- `description` (text)
- `unit_cost` (decimal(12,2))
- `quantity` (decimal(10,2)) — **single number, used for math**
- `quantity_note` (varchar, nullable) — **free-text shown next to quantity on the PDF, e.g. "8 X 3 (months)"**
- `line_total` (decimal(12,2))

### invoice_revisions
Captures a snapshot of an invoice every time it is edited *after* it was sent. Used so the customer's original PDF copy is preserved alongside the corrected one.
- `id` PK
- `invoice_id` FK → invoices
- `revision_number` (int)
- `snapshot_json` (JSON of the full invoice + items at that revision)
- `pdf_path` (string, path to the archived PDF)
- `created_at`

### email_logs
Audit trail for every send.
- `id` PK
- `invoice_id` FK → invoices
- `to_email`
- `cc_emails_json` (JSON array)
- `subject`
- `body_html`
- `sent_at`
- `sent_by` FK → users

### invoice_counters
- `year` PK (int)
- `last_number` (int) — next claim is `last_number + 1`. Reset by admin sets back to 0.

### settings
Single-row table (enforced by `id = 1`).
- `id` (always 1)
- `vat_rate` (decimal, e.g. 13.00)
- `currency_label` (e.g. "rupees")
- `from_company_name`, `from_address`, `from_pan`, `from_email`
- `bank_details` (text)
- `contact_name`, `contact_email`, `contact_phone`
- `logo_path`

## 5. Modules & pages

| URL | Method | Page / action | Access |
|---|---|---|---|
| `/login` | GET/POST | Login form | public |
| `/` | GET | Dashboard (recent invoices, quick links) | any user |
| `/customers` | GET | Customer list (search) | any user |
| `/customers/new` | GET/POST | Create customer | admin |
| `/customers/:id` | GET | Customer detail + "Create invoice" button | any user |
| `/customers/:id/edit` | GET/POST | Edit customer | admin |
| `/invoices` | GET | Invoice list (filter by year/customer/status) | any user |
| `/invoices/new?customerId=…` | GET/POST | Create invoice form (Alpine.js for items) | admin |
| `/invoices/:id` | GET | View invoice + actions | any user |
| `/invoices/:id/edit` | GET/POST | Edit invoice | admin |
| `/invoices/:id/pdf` | GET | Download latest PDF | any user |
| `/invoices/:id/email` | GET/POST | Email preview & send | admin |
| `/settings` | GET/POST | Edit settings (VAT, currency, from-company, bank, contact) | admin |
| `/settings/counter` | GET/POST | Reset invoice counter for current year | admin |
| `/users` | GET/POST | List/create users | admin |
| `/users/:id/edit` | GET/POST | Edit user | admin |

## 6. Key flows

### 6.1 Create invoice
1. Admin clicks "Create invoice" from customer detail or `/invoices/new?customerId=…`.
2. Form pre-fills today's date and shows the *expected* next number for the current year (read-only display: `last_number + 1`, padded to 3 digits — not yet committed).
3. Alpine.js manages line items: add row, remove row, live `line_total = qty × unit_cost`, live subtotal/VAT/grand total. Amount-in-words preview is computed client-side too and editable in a textarea.
4. On submit, server validates (class-validator DTOs).
5. In a single transaction:
   - `SELECT … FOR UPDATE` on `invoice_counters[year]`, increment `last_number`, claim that as the invoice number.
   - Insert `invoices` row with `status = draft`, `revision = 1`.
   - Insert `invoice_items` rows.
6. Generate PDF via Puppeteer → write to `storage/invoices/{year}-{number}-r1.pdf`.
7. Redirect to `/invoices/:id` view page.

### 6.2 Edit invoice
- If `status = draft`: update rows in place, regenerate PDF, overwrite the file.
- If `status = sent` or `corrected`: snapshot current state into `invoice_revisions` (with the current PDF path), bump `invoices.revision`, update rows, regenerate PDF to `storage/invoices/{year}-{number}-r{n}.pdf`, set `status = corrected`. The previous PDF stays on disk for the customer's records.

### 6.3 Send email
1. Admin opens `/invoices/:id/email` → preview screen.
2. Default subject:
   - Normal: `Invoice #{number} from Aquester Solutions Pvt. Ltd.`
   - Correction (status = `corrected`): `Corrected invoice #{number} from Aquester Solutions Pvt. Ltd.`
3. Body template (Handlebars):
   - Short cover note: greeting, invoice number, total amount, "PDF attached".
   - For corrections, includes: *"We found an error on the previous invoice. Please find the corrected version attached and discard the earlier copy."*
4. CC field is pre-filled from `customer_cc_emails`. Admin can add/remove addresses on this screen.
5. Subject and CC are editable; "To" is locked to `customers.primary_email`.
6. On send: Nodemailer sends with the *latest* PDF attached (`{year}-{number}-r{revision}.pdf`).
7. On success: write `email_logs` row, set `invoices.status = sent` (if it was `draft`) and `sent_at = now()`. If it was already `sent` or `corrected`, only `email_logs` is appended; status stays `corrected`.

### 6.4 Reset counter
- `/settings/counter` shows current year's `last_number` and the *next* number that would be claimed.
- "Reset to 0" button with a confirm dialog. After reset, the next invoice claims `0 + 1 → 001`.

### 6.5 Amount in words
- Computed server-side using the `number-to-words` library.
- Post-processed: capitalised first word + `" {currency_label} only."` (e.g. *"Forty-six thousand seven hundred eighty-two rupees only."*).
- Pre-filled into an editable textarea on the invoice form so admin can override before save.

## 7. PDF template

A single Handlebars template (`views/invoice.hbs`) is used both for the in-browser preview at `/invoices/:id` and as the source HTML for Puppeteer. The template is laid out exactly to match the supplied Aquester invoice mock:

- **Header band:** logo (left) | FROM block (centre, from settings) | TO block (right, from customer)
- **"Invoice" title pill** (rounded, orange background)
- **Invoice metadata row:** `INVOICE NO.` (padded number), `INVOICE DATE` (formatted "22nd Sep 2025")
- **Line items table:** ITEM | DESCRIPTION | UNIT COST | QUANTITY (`{quantity}{quantity_note ? "  " + quantity_note : ""}`) | TOTAL
- **Totals block:** Subtotal, Vat 13%, Total (right-aligned)
- **In-words line** (left, below totals)
- **Footer block:** bank details + contact-person info, all from settings

CSS is embedded in the template so Puppeteer doesn't need an extra HTTP request. Logo is referenced as a `file://` URL.

## 8. Authentication

- Login form posts email + password; password verified against `users.password_hash` (bcrypt).
- On success, server signs a JWT (subject = user id, role claim) and sets it as an `httpOnly`, `secure-when-https`, `SameSite=Lax` cookie named `aq_token`.
- A global `JwtAuthGuard` reads the cookie on every request, populates `req.user`. Public routes (`/login`, static assets) are decorated with `@Public()`.
- A `RolesGuard` checks `req.user.role` against `@Roles('admin')` decorators on admin-only routes.
- Logout: clear the cookie, redirect to `/login`.

## 9. Error handling

- **Validation:** class-validator DTOs; failures re-render the form with inline messages.
- **Counter race:** invoice number claim runs inside a transaction with `SELECT … FOR UPDATE` on the counter row.
- **PDF generation failure:** invoice still saves; PDF is regenerated on demand when admin clicks Download/Send. Errors logged.
- **Email failure (SMTP down, bad address):** caught at send time, surfaced on the email preview page with the SMTP error message; nothing is marked sent. `email_logs` row is only written on success.
- **Auth:** invalid/expired JWT → redirect to `/login`. Role guard on admin-only routes returns a 403 page.
- **404 / 500:** simple Handlebars error pages.

## 10. Testing

Lightweight by design — this is a small in-house tool.

**Unit tests (Jest):**
- Money math: line total, subtotal, VAT, grand total — including rounding to 2dp.
- Amount-in-words helper: zero, decimals, large numbers, currency suffix.
- Counter service: claim-next, reset, concurrent claim under transaction.

**E2E tests (Supertest):**
- Login → create customer → create invoice → download PDF (verify a non-empty PDF buffer with `%PDF-` header).
- Edit a sent invoice → confirm `invoice_revisions` row + new PDF file + `status = corrected`.
- Auth/role guards: viewer cannot open `/settings`, `/users`, `/customers/new`, `/invoices/new`.

**Out of scope:** Alpine.js form interaction tests, real SMTP delivery tests, Puppeteer pixel-diff tests. Visual checks during development are sufficient for a fixed-template PDF.

## 11. Configuration (`.env`)

```
APP_PORT=3000
JWT_SECRET=...
JWT_EXPIRES=12h
COOKIE_SECURE=false        # true in production
DB_HOST=localhost
DB_PORT=3306
DB_USER=...
DB_PASS=...
DB_NAME=aquester_invoice
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_USER=kamal@aquester.com
SMTP_PASS=...              # Gmail App Password
SMTP_FROM="Aquester Solutions <kamal@aquester.com>"
PDF_STORAGE_DIR=./storage/invoices
```

## 12. Out of scope (future work)

- Payment tracking / paid-vs-unpaid status / scheduled reminders
- Items catalog (free-form per invoice for now)
- Multi-currency math (currency is a label only; all math is rupees)
- Docker / production deployment
- File upload for logo (logo is a static asset bundled in `public/`)
