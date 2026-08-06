# IMPLEMENTATION STATUS — Timesheet + Supplier Portal Workflow

> **Generated**: February 2026  
> **Codebase**: Gardeo / Guardosmart — Enterprise Workforce Management Platform  
> **Purpose**: Factual, code-backed audit of what is done vs not done for Timesheets, Supplier Portal, Disputes, Invoicing/Self-Billing, and related features. Intended for handoff to an architect to plan the next MVP phases.  
> **Note on line references**: Line numbers are approximate and may shift as the codebase evolves. Endpoint paths and function names are the stable references.

---

## A) System Overview

### Tech Stack

| Layer | Technology | Evidence |
|-------|-----------|----------|
| Frontend | React 18 + TypeScript, Wouter routing, Shadcn/UI, Tailwind CSS, TanStack Query v5 | `client/src/App.tsx`, `vite.config.ts`, `package.json` |
| Backend | Express.js, Passport.js (passport-local strategy), express-session with PostgreSQL session store | `server/routes.ts` (lines 48–77), `server/index.ts` |
| Database | PostgreSQL via Drizzle ORM | `server/db.ts`, `shared/schema.ts` (935 lines, 30+ tables) |
| Email | Resend API (optional — degrades gracefully if `RESEND_API_KEY` not set) | `server/email.ts` (line 7–16) |
| AI | OpenAI via Replit AI Integrations | `server/replit_integrations/chat/`, `client/src/pages/ai-scheduling.tsx` |
| Auth | Custom Passport.js with bcrypt password hashing, session-based | `server/routes.ts` lines 60–100, NOT Replit Auth |
| Object Storage | Replit Object Storage for document uploads | `server/replit_integrations/object_storage/` |
| Hosting | Replit (Express serves both API + Vite frontend on port 5000) | `server/vite.ts` |

### Supplier Portal Structure

| URL Route | Page Component | Purpose |
|-----------|---------------|---------|
| `/supplier-portal` | `supplier-portal.tsx` (1,443 lines) | Main supplier dashboard: company profile, documents, notifications, pending changes |
| `/supplier-documents` | `supplier-documents.tsx` | Document management for supplier |
| `/supplier-policies` | `supplier-policies.tsx` | Policy document upload/review |
| `/supplier-timesheets` | `supplier-timesheets.tsx` (442 lines) | Timesheet review, approve, dispute |
| `/self-billing-agreement` | `self-billing-agreement.tsx` (507 lines) | HMRC-compliant self-billing agreement signing |

**Admin-side supplier management:**

| URL Route | Page Component | Purpose |
|-----------|---------------|---------|
| `/suppliers` | `suppliers.tsx` | Supplier list with status management |
| `/suppliers/:id` | `supplier-detail.tsx` | Detailed supplier view, document review, status actions |
| `/finance` | `finance.tsx` (467 lines) | Invoice management (admin), finance summary |

### High-Level Current Flow (as implemented)

1. Admin creates a supplier record → optionally enables portal access → sends email invitation.
2. Supplier accepts invitation, sets password, logs in with role `supplier`.
3. Supplier completes profile (company details, VAT, bank, labour section), uploads required documents, submits for review.
4. Admin reviews/approves supplier, documents, and policies.
5. Admin creates shifts, optionally assigns `supplierId` to a shift.
6. Supplier views assigned shifts as "timesheets" and can approve or dispute each one individually.
7. Self-billing agreement can be signed by the supplier (requires VAT registration).
8. Admin can manually create invoices on the Finance page (validated against self-billing agreement status).
9. **Nothing happens automatically after timesheet approval** — no automated invoice generation, no payment trigger.

---

## B) Current Timesheet Feature (DETAILED)

### Data Model

There is **no dedicated `timesheets` table**. Timesheets are derived from the `shifts` table, with supplier-specific approval columns added directly to shifts.

**Table: `shifts`** — `shared/schema.ts` lines 277–314

| Column | Type | Purpose |
|--------|------|---------|
| `id` | serial PK | |
| `tenantId` | integer FK → tenants | Multi-tenant isolation |
| `siteId` | integer FK → sites | Where the shift occurs |
| `employeeId` | integer FK → employees | Assigned officer |
| `supplierId` | integer | Supplier company the shift is assigned to (no FK constraint) |
| `title` | text | Shift name |
| `date` | date | Shift date |
| `startTime` / `endTime` | text | e.g. "08:00" / "18:00" |
| `breakMinutes` | integer | Break duration |
| `status` | enum: `scheduled`, `in_progress`, `completed`, `cancelled`, `no_show` | Shift lifecycle |
| `supplierApprovalStatus` | text (free-form) | Values used: `null`, `"approved"`, `"disputed"` |
| `supplierApprovalComment` | text | Dispute reason |
| `supplierApprovedAt` | timestamp | When approval/dispute occurred |
| `supplierApprovedBy` | varchar FK → users | Who approved/disputed |
| `checkInTime` / `checkOutTime` | timestamp | Officer check-in/out |
| `controllerNotes` | text | Notes from control room |
| `precheckData` | jsonb | SIA/DBS/uniform/equipment pre-check |

**Key relationships:**
- `shifts.supplierId` → integer, **no foreign key constraint** to `suppliers.id`
- `shifts.employeeId` → FK to `employees.id`
- `shifts.siteId` → FK to `sites.id`

### API Endpoints

| Method | Path | Handler | Auth | Purpose |
|--------|------|---------|------|---------|
| `GET` | `/api/supplier-portal/timesheets` | `server/routes.ts:2625` | `requireRole("supplier")` | List all shifts assigned to supplier's company, enriched with site/employee names |
| `PATCH` | `/api/supplier-portal/timesheets/:id/approve` | `server/routes.ts:2665` | `requireRole("supplier")` | Set `supplierApprovalStatus = "approved"` |
| `PATCH` | `/api/supplier-portal/timesheets/:id/dispute` | `server/routes.ts:2698` | `requireRole("supplier")` | Set `supplierApprovalStatus = "disputed"` + store comment |
| `POST` | `/api/data-import/timesheets` | `server/routes.ts:4077` | Admin roles | Bulk CSV import of timesheet/shift data |

**Note:** There is **no admin-side endpoint** for viewing supplier timesheet approval status or managing disputes.

### UI Pages

| Route | Component | File | Purpose |
|-------|-----------|------|---------|
| `/supplier-timesheets` | `SupplierTimesheetsPage` | `client/src/pages/supplier-timesheets.tsx` | Full-featured supplier timesheet review page |

**UI features implemented:**
- Summary cards: Total Shifts, Pending Review, Approved, Disputed counts
- Search by site/officer/title/date
- Filter by approval status (All, Pending, Approved, Disputed)
- Expandable shift cards with full details (site, officer, hours, break, notes)
- Approve button (one-click)
- Dispute button → opens dialog requiring a comment
- Dispute comment display on disputed timesheets
- Approval/dispute timestamp display
- Hours calculation from start/end times minus break

### Status Model

**Shift lifecycle statuses** (enum in schema, line 246):
- `scheduled` → `in_progress` → `completed` / `cancelled` / `no_show`
- Transitions happen via admin/controller actions in `PATCH /api/shifts/:id`

**Supplier approval statuses** (free-form text on `supplierApprovalStatus`):
- `null` (not yet reviewed) → shown as "Pending Review" in UI
- `"approved"` — supplier confirmed the timesheet
- `"disputed"` — supplier raised a dispute with comment

**Where transitions happen:**
- Approve: `server/routes.ts:2676` — `updateShift(shiftId, { supplierApprovalStatus: "approved", ... })`
- Dispute: `server/routes.ts:2712` — `updateShift(shiftId, { supplierApprovalStatus: "disputed", ... })`
- **No transition back** from disputed → pending or disputed → approved (no re-review capability)

### Supplier Actions Supported Now

| Action | Status | Evidence |
|--------|--------|----------|
| View all assigned shifts/timesheets | ✅ Done | `GET /api/supplier-portal/timesheets` + UI |
| Approve individual shift | ✅ Done | `PATCH .../approve` + UI button |
| Dispute individual shift with comment | ✅ Done | `PATCH .../dispute` + UI dialog |
| Filter/search timesheets | ✅ Done | Client-side filtering in `supplier-timesheets.tsx` |
| View approval/dispute history per shift | ✅ Done | Timestamp + comment shown in expanded card |
| Bulk approve multiple shifts | ❌ Not implemented | No batch endpoint or UI |
| Re-dispute or change decision | ❌ Not implemented | No status reversal logic |
| View calculated pay/cost for shift | ❌ Not implemented | Hours shown, but no rate or monetary value |

### Admin/Internal Actions Supported Now

| Action | Status | Evidence |
|--------|--------|----------|
| Create shifts with supplier assignment | ✅ Done | `POST /api/shifts` + scheduling UI |
| Edit shifts (time, status, reassign) | ✅ Done | `PATCH /api/shifts/:id` |
| Delete shifts | ✅ Done | `DELETE /api/shifts/:id` |
| View supplier approval status on shifts | 🟡 Partial | `supplierApprovalStatus` stored but **not displayed in any admin UI** |
| Manage disputes (respond, resolve) | ❌ Not implemented | No admin dispute management |
| View timesheet report by supplier | ❌ Not implemented | No reporting endpoint |
| Bulk CSV import of timesheets | ✅ Done | `POST /api/data-import/timesheets` |

### What Happens After Approval Today

**Nothing.** When a supplier approves a timesheet:
1. The shift's `supplierApprovalStatus` is set to `"approved"` in the database.
2. An audit log entry is created (`action: "supplier_timesheet_approved"`).
3. **No invoice is generated.**
4. **No notification is sent to admin.**
5. **No payment is triggered.**
6. **No downstream workflow exists.**

---

## C) Dispute Capability

### Status: 🟡 Partial — Basic dispute exists, no resolution workflow

**What exists:**

| Item | Evidence |
|------|----------|
| Dispute endpoint | `PATCH /api/supplier-portal/timesheets/:id/dispute` — `server/routes.ts:2698` |
| Dispute status | `supplierApprovalStatus: "disputed"` stored on `shifts` table |
| Dispute comment | `supplierApprovalComment` column on `shifts` table — `schema.ts:308` |
| Dispute UI (supplier) | Dispute button + comment dialog in `supplier-timesheets.tsx:361–371` |
| Dispute audit log | `action: "supplier_timesheet_disputed"` logged — `routes.ts:2722` |

**What does NOT exist:**

| Item | Search evidence |
|------|----------------|
| Dedicated `disputes` table | No table containing "dispute" in `schema.ts` — confirmed by full schema read |
| Dispute resolution workflow | No endpoint for admin to resolve/reject/accept disputes |
| Admin dispute management UI | No admin page for viewing or managing disputes |
| Dispute status lifecycle | Only one state: `"disputed"`. No `"under_review"`, `"resolved"`, `"escalated"` |
| Dispute notifications | No notification created when supplier disputes a timesheet |
| Dispute messaging/thread | Single `supplierApprovalComment` field — no back-and-forth communication |
| Re-dispute or amend dispute | No way for supplier to update or withdraw a dispute |

### Gaps

- A supplier can dispute a shift, but the admin has no visibility into disputes (no admin-side filtering or UI for disputed timesheets).
- There is no resolution pathway — once disputed, the shift stays disputed forever with no mechanism to resolve, adjust, or re-approve.
- Dispute comment is a single text field, not a conversation thread.
- No notification sent when a dispute is raised.

---

## D) Invoicing / Billing / Payments

### Status: 🟡 Partial — Manual invoice CRUD exists, no automation

### Invoice Data Model

**Table: `invoices`** — `shared/schema.ts` lines 592–613

| Column | Type | Purpose |
|--------|------|---------|
| `id` | serial PK | |
| `tenantId` | integer FK → tenants | Multi-tenant isolation |
| `supplierId` | integer FK → suppliers | Which supplier this invoice is for |
| `employeeId` | integer FK → employees | Optional: specific employee |
| `invoiceNumber` | text NOT NULL | Invoice reference |
| `periodStart` / `periodEnd` | date | Billing period |
| `totalHours` | text | Hours covered |
| `hourlyRate` | text | Rate per hour |
| `subtotal` | text NOT NULL | Pre-VAT amount |
| `vatRate` | text (default "20") | UK VAT rate |
| `vatAmount` | text NOT NULL | VAT amount |
| `totalAmount` | text NOT NULL | Total including VAT |
| `status` | enum: `draft`, `pending`, `approved`, `paid`, `overdue`, `cancelled` | Invoice lifecycle |
| `dueDate` | date | Payment due date |
| `paidAt` | timestamp | When marked paid |
| `notes` | text | |
| `createdBy` | varchar FK → users | Who created |

### Invoice API Endpoints

| Method | Path | Handler | Purpose |
|--------|------|---------|---------|
| `GET` | `/api/invoices` | `routes.ts:2953` | List all invoices for tenant (admin roles) |
| `POST` | `/api/invoices` | `routes.ts:2974` | Create invoice — validates self-billing agreement if `supplierId` provided |
| `PATCH` | `/api/invoices/:id` | `routes.ts:3001` | Update invoice (status, amounts, etc.) |
| `GET` | `/api/finance/summary` | `routes.ts:3016` | Finance dashboard summary (totals, counts by status) |

### Invoice UI

**Page: `/finance`** — `client/src/pages/finance.tsx` (467 lines)

Features:
- Summary cards: Total Invoiced, VAT, Paid, Pending, Overdue
- Invoice list with status badges (draft/pending/approved/paid/overdue/cancelled)
- Create invoice dialog (manual entry: invoice number, period, hours, rate)
- VAT auto-calculated at 20%
- Status filter
- Currency formatted as GBP

### Self-Billing Agreement

**Supplier schema fields** — `schema.ts` lines 431–437:
- `selfBillingAgreementStatus`: `"none"` | `"active"`
- `selfBillingSignatoryName`, `selfBillingSignatoryPosition`
- `selfBillingAcceptedAt`, `selfBillingExpiryDate`, `selfBillingAgreementRef`
- `billingFrequency`: `"weekly"` | `"fortnightly"` | `"monthly"`

**Self-Billing API Endpoints:**

| Method | Path | Handler | Purpose |
|--------|------|---------|---------|
| `GET` | `/api/supplier-portal/self-billing-agreement` | `routes.ts:2736` | Get agreement status + supplier/buyer details |
| `POST` | `/api/supplier-portal/self-billing-agreement/accept` | `routes.ts:2772` | Sign agreement (requires VAT registration) |
| `GET` | `/api/supplier-portal/self-billing-agreement/document/:ref` | `routes.ts:2846` | Get agreement document data (JSON, not PDF) |

**Self-Billing UI** — `client/src/pages/self-billing-agreement.tsx` (507 lines):
- Full HMRC VAT Notice 700/62 compliant agreement text
- Buyer/supplier details display
- Signatory name + position input
- Terms and conditions (10 clauses)
- Acceptance checkbox
- Signed status display with expiry date
- Agreement reference display

**Self-billing validation on invoice creation** — `routes.ts:2977–2987`:
- If `supplierId` is provided when creating an invoice, the system checks that the supplier has an active, non-expired self-billing agreement.
- Returns 400 error with HMRC reference if agreement is missing or expired.

### What's Missing in Invoicing

| Gap | Detail |
|-----|--------|
| Automated invoice generation | No mechanism to auto-create invoices from approved timesheets |
| Invoice line items | No line items table — invoice is a flat record, not linked to individual shifts |
| Supplier invoice view | Suppliers cannot see their invoices (no supplier-portal invoice endpoint) |
| PDF invoice generation | No PDF generation library installed. Self-billing "document" endpoint returns JSON, not a real PDF |
| Payment integration | No payment gateway or bank transfer tracking |
| Credit notes / debit notes | ❌ Not implemented — no tables, models, or endpoints |
| Invoice numbering auto-increment | Manual entry — no sequential numbering system |
| Period validation | No check that invoice period doesn't overlap with existing invoices |
| Link to timesheets | No FK or reference from invoices to shifts/timesheets |

---

## E) Missing Self-Billing Module

### Status: ❌ Not implemented as a complete module

**What exists** (see Section D above):
- Self-billing agreement signing (supplier-side)
- Agreement validation before invoice creation
- Basic manual invoice CRUD

**What is NOT implemented — confirmed by code search:**

| Missing Component | Search Evidence |
|-------------------|-----------------|
| Automated self-billed invoice generation from approved timesheets | No code linking `supplierApprovalStatus === "approved"` to invoice creation |
| Self-billing invoice numbering (HMRC-compliant sequential) | `invoiceNumber` is manual text input |
| Self-billing invoice PDF generation | No PDF library in `package.json`; no PDF generation code |
| Supplier-visible invoice history | No `/api/supplier-portal/invoices` endpoint |
| HMRC MTD (Making Tax Digital) integration | No MTD-related code |
| Credit notes for post-issue corrections | No `credit_notes` table or related code |
| Debit notes | No `debit_notes` table or related code |
| Self-billing agreement renewal workflow | Expiry date stored but no renewal reminder or process |
| Billing frequency enforcement | `billingFrequency` stored on supplier but not used in any scheduling or automation |
| Rate card / agreed rates | No rate table linking suppliers to hourly rates per site/role |

### Structural Requirements to Add Self-Billing Module

1. **New tables needed:**
   - `self_billing_invoices` (or extend `invoices` with type field) — with HMRC-compliant numbering, linked to shifts
   - `invoice_line_items` — individual shift/timesheet entries per invoice
   - `credit_notes` — for post-issue corrections
   - `debit_notes` — for adjustments
   - `rate_cards` — agreed hourly rates per supplier/site/role

2. **New API routes needed:**
   - `POST /api/self-billing/generate` — auto-generate invoice from approved timesheets for a billing period
   - `GET /api/supplier-portal/invoices` — supplier view of their invoices
   - `GET /api/self-billing/invoices/:id/pdf` — PDF download
   - `POST /api/credit-notes` — create credit note against an invoice
   - `POST /api/debit-notes` — create debit note

3. **New services needed:**
   - Invoice generation service (collects approved timesheets → calculates totals → creates invoice + line items)
   - PDF generation service (using e.g. `@react-pdf/renderer` or `pdfmake`)
   - Billing schedule service (runs on `billingFrequency` to auto-generate)
   - Rate card lookup service

4. **New UI pages needed:**
   - Admin: Self-billing invoice list + detail view
   - Admin: Credit/debit note management
   - Supplier: Invoice history view
   - Supplier: Invoice dispute/query capability

---

## F) Quality & Risk Notes

### Hardcoded Assumptions

| Issue | Location | Detail |
|-------|----------|--------|
| VAT rate hardcoded to 20% | `schema.ts:603` | `vatRate` defaults to `"20"` — no support for zero-rated, exempt, or reduced rate supplies |
| Self-billing agreement validity: 1 year | `routes.ts:2789` | `expiryDate.setFullYear(expiryDate.getFullYear() + 1)` — hardcoded 12-month validity |
| Buyer name fallback | `routes.ts:2762,2830` | Falls back to `"GuardianFM"` if tenant company name not set |
| Currency assumed GBP | `finance.tsx:63` | `Intl.NumberFormat("en-GB", { currency: "GBP" })` — no multi-currency support |
| Billing frequency options | `routes.ts:1315-1316` | Validated against `["weekly", "fortnightly", "monthly"]` only |

### Permission / Security Risks

| Risk | Severity | Detail |
|------|----------|--------|
| No FK constraint on `shifts.supplierId` | Medium | `supplierId` is a plain integer column with no foreign key to `suppliers.id` (`schema.ts:282`). Allows orphaned references. |
| Supplier can approve any shift assigned to them | Low | Ownership check exists (`s.supplierId === supplier.id`), but uses in-memory filtering on all tenant shifts rather than a DB-level query. With large datasets this could be slow and is harder to audit. |
| No check for "already approved" before re-approving | Medium | Supplier can re-approve an already-approved shift. No idempotency check in `routes.ts:2665`. |
| Supplier can dispute an already-approved shift | Medium | No guard preventing dispute after approval. Supplier can flip between approved ↔ disputed freely. |
| Invoice update has no status transition validation | High | `PATCH /api/invoices/:id` accepts any body and passes it directly to `storage.updateInvoice(id, req.body)` with no validation (`routes.ts:3004`). Any field can be overwritten, including `totalAmount`. |
| Self-billing agreement document returns JSON, not authenticated PDF | Low | `GET .../document/:ref` returns JSON data. The document record in `supplier_documents` references this endpoint with `mimeType: "application/pdf"` but it's not actually a PDF. |
| No tenant isolation check on invoice update | High | `PATCH /api/invoices/:id` does not verify the invoice belongs to the user's tenant (`routes.ts:3001–3013`). |

### Missing Validation

| Item | Detail |
|------|--------|
| No validation that shift is "completed" before supplier approval | Supplier can approve a shift that is still `scheduled` or `in_progress` |
| No validation of duplicate invoice numbers | `invoiceNumber` is not checked for uniqueness per tenant |
| No validation of invoice period overlap | Same period can have multiple invoices for the same supplier |
| No rate validation on invoices | `hourlyRate` and `totalHours` are optional text fields, not validated against shift data |

### Missing Audit Trail

| Item | Detail |
|------|--------|
| Timesheet approval is audited | ✅ `action: "supplier_timesheet_approved"` in audit_logs — `routes.ts:2683` |
| Timesheet dispute is audited | ✅ `action: "supplier_timesheet_disputed"` in audit_logs — `routes.ts:2719` |
| Invoice creation is audited | ✅ `action: "invoice_created"` — `routes.ts:2990` |
| Invoice update is audited | ✅ `action: "invoice_updated"` — `routes.ts:3005` |
| Self-billing agreement signing is audited | ✅ `action: "self_billing_agreement_signed"` — `routes.ts:2818` |
| Invoice deletion is NOT possible | N/A (no delete endpoint) |
| Who changed invoice status is tracked | 🟡 Partially — `userId` logged but specific field changes not tracked |
| Timesheet approval reversal | ❌ Not tracked (because reversal doesn't exist) |

### Missing Data Integrity Constraints

| Constraint | Detail |
|-----------|--------|
| `shifts.supplierId` has no FK | Should reference `suppliers.id` |
| `supplierApprovalStatus` is free-form text | Should be an enum (`pgEnum`) like other status fields |
| Invoice amounts stored as text | `subtotal`, `vatAmount`, `totalAmount` are `text` — should be `numeric` or `decimal` for financial accuracy |
| No unique constraint on `invoiceNumber` per tenant | Allows duplicate invoice numbers |

---

## G) Recommended Next Steps

### To Complete Timesheets MVP

Ordered by dependency:

- [ ] 1. Add FK constraint: `shifts.supplierId` → `suppliers.id`
- [ ] 2. Convert `supplierApprovalStatus` to a proper `pgEnum` (values: `pending`, `approved`, `disputed`, `resolved`)
- [ ] 3. Add validation: only allow approval/dispute of shifts with status `completed`
- [ ] 4. Add guard: prevent re-approval of already-approved shifts (idempotency)
- [ ] 5. Add guard: prevent dispute of already-approved shifts (or add explicit "revoke approval" action)
- [ ] 6. Create admin endpoint: `GET /api/admin/supplier-timesheets` — list shifts with supplier approval status, filterable by supplier/status/date
- [ ] 7. Add admin UI for viewing supplier timesheet approval status (new tab in supplier detail or dedicated page)
- [ ] 8. Add notification to admin when supplier disputes a timesheet
- [ ] 9. Add bulk approve capability for suppliers (select multiple → approve all)
- [ ] 10. Add rate/cost display on supplier timesheets (requires rate card — see Self-Billing MVP)
- [ ] 11. Add "timesheet period" concept — group shifts by week/fortnight/month for billing

### To Add Disputes MVP

Ordered by dependency:

- [ ] 1. Create `disputes` table: `id`, `shiftId`, `supplierId`, `tenantId`, `status` (enum: `open`, `under_review`, `resolved`, `escalated`), `reason`, `resolution`, `resolvedBy`, `resolvedAt`, `createdAt`
- [ ] 2. Create `dispute_messages` table for threaded conversation: `id`, `disputeId`, `userId`, `message`, `createdAt`
- [ ] 3. Migrate existing `supplierApprovalComment` data into new `disputes` table
- [ ] 4. Create API endpoints:
  - `POST /api/disputes` — supplier raises dispute (linked to shift)
  - `GET /api/disputes` — list disputes (admin: all for tenant; supplier: own)
  - `GET /api/disputes/:id` — dispute detail with messages
  - `POST /api/disputes/:id/messages` — add message to dispute thread
  - `PATCH /api/disputes/:id/resolve` — admin resolves dispute
  - `PATCH /api/disputes/:id/escalate` — escalate dispute
- [ ] 5. Create supplier dispute UI: dispute list, detail view with message thread
- [ ] 6. Create admin dispute management UI: queue, detail, resolve/escalate actions
- [ ] 7. Add notifications for dispute lifecycle (raised → admin notified; resolved → supplier notified)
- [ ] 8. Update timesheet UI to link to dispute detail when disputed
- [ ] 9. Define business rules: what happens to the shift/timesheet when dispute is resolved (adjust hours? cancel? re-approve?)

### To Add Self-Billing MVP

Ordered by dependency:

- [ ] 1. Create `rate_cards` table: `id`, `supplierId`, `tenantId`, `siteId` (optional), `roleType`, `hourlyRate`, `overtimeRate`, `effectiveFrom`, `effectiveTo`, `createdBy`, `createdAt`
- [ ] 2. Create `invoice_line_items` table: `id`, `invoiceId` FK, `shiftId` FK, `description`, `hours`, `rate`, `subtotal`, `createdAt`
- [ ] 3. Create `self_billing_invoices` table (or add `invoiceType` enum to existing `invoices` with values `manual`, `self_billed`): add `billingPeriod`, `approvedTimesheetCount`, `generatedAt`
- [ ] 4. Convert invoice monetary columns from `text` to `numeric(12,2)` for financial accuracy
- [ ] 5. Add unique constraint on `invoiceNumber` per tenant
- [ ] 6. Build invoice generation service:
  - Collect all shifts for a supplier in a billing period where `supplierApprovalStatus = 'approved'`
  - Look up applicable rate from `rate_cards`
  - Calculate hours, subtotal, VAT, total
  - Create invoice + line items
  - Generate sequential HMRC-compliant invoice number (e.g. `SBI-{tenant}-{YYYYMM}-{seq}`)
- [ ] 7. Build PDF generation service (install `@react-pdf/renderer` or `pdfmake`):
  - Self-billing invoice PDF with all HMRC-required fields
  - Credit note PDF
- [ ] 8. Create API endpoints:
  - `POST /api/self-billing/generate` — generate invoice for supplier + period
  - `GET /api/self-billing/invoices` — list self-billed invoices
  - `GET /api/self-billing/invoices/:id/pdf` — download PDF
  - `GET /api/supplier-portal/invoices` — supplier views their invoices
- [ ] 9. Create admin UI: self-billing dashboard, invoice generation wizard, invoice detail + PDF preview
- [ ] 10. Create supplier UI: invoice history, PDF download, query/dispute invoice
- [ ] 11. Add billing frequency automation: scheduled job per `supplier.billingFrequency`
- [ ] 12. Add self-billing agreement renewal reminders (30 days before expiry)
- [ ] 13. Add tenant isolation check on all invoice endpoints

### To Support Post-Issue Corrections (Credit / Debit Notes)

Ordered by dependency:

- [ ] 1. Create `credit_notes` table: `id`, `tenantId`, `invoiceId` FK, `creditNoteNumber`, `reason`, `lineItems` (jsonb or FK to `credit_note_line_items`), `subtotal`, `vatAmount`, `totalAmount`, `status` (enum: `draft`, `issued`, `applied`), `issuedBy`, `issuedAt`, `createdAt`
- [ ] 2. Create `debit_notes` table: similar structure to credit notes, for additional charges
- [ ] 3. Add sequential numbering for credit/debit notes (e.g. `CN-{tenant}-{YYYYMM}-{seq}`, `DN-...`)
- [ ] 4. Create API endpoints:
  - `POST /api/credit-notes` — create credit note against invoice
  - `GET /api/credit-notes` — list credit notes
  - `GET /api/credit-notes/:id/pdf` — download PDF
  - Same pattern for debit notes
- [ ] 5. Build PDF generation for credit/debit notes (HMRC-compliant)
- [ ] 6. Create admin UI for issuing and managing credit/debit notes
- [ ] 7. Add supplier visibility: supplier can see credit/debit notes in their portal
- [ ] 8. Add adjustment workflow: dispute resolved → credit note auto-generated for disputed hours
- [ ] 9. Update finance summary to include credit/debit note totals
- [ ] 10. Add audit trail for all credit/debit note actions

---

*End of Implementation Status Report*
