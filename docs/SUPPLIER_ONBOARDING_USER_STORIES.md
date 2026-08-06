# Supplier Onboarding (Limited Company Only) — User Stories & Codebase Validation

This document lists all user stories for **Supplier Onboarding** (Admin + Supplier Portal) and validates each against the current Guardosmart codebase. For each story, the **Codebase status** indicates what is already implemented, partial, or missing.

---

## Overview

### Statuses (system-controlled)

| Status        | Meaning |
|---------------|--------|
| **Draft**     | Created by Admin, not yet submitted |
| **Submitted** | Supplier finished and clicked Submit |
| **Approved**  | Admin approved onboarding |
| **Info Required** | Admin requested changes (with notes) |
| **Suspended** | Previously approved, now blocked by Admin |

**Rule:** Supplier cannot set statuses directly. Status changes only occur via system actions (Submit / Approve / Request Info / Suspend).

### Roles

- **Admin** — Creates suppliers, reviews, approves, requests info, suspends.
- **Supplier User** — Portal user; completes profile, documents, submits onboarding.

### Current Codebase Statuses (Different)

The app uses a **different status model** for suppliers:

- **Current enum:** `pending` \| `approved` \| `active` \| `suspended` \| `terminated`
- **Location:** `shared/schema.ts` — `supplierStatusEnum`, `suppliers.status` (default `"pending"`)
- **Gap:** No **Draft**, **Submitted**, or **Info Required**. New suppliers are created as `pending`; there is no dedicated “supplier onboarding” flow with submit/resubmit.

---

## Required Data (Limited Company)

### Admin creates (minimum)

- Supplier legal name  
- Company Registration Number (CRN)  
- Supplier email (portal login)  
- Supplier type: Labour supplier / Non-labour supplier  
- Status (auto)

### Supplier completes (portal)

- **Company:** Registered office address, trading address, main contact, finance contact, nature of supply, VAT status (VAT Registered / Not VAT Registered)  
- **VAT path:** VAT number + evidence + sample invoice **or** Non-VAT reason + declaration + upload  
- **Bank details:** Account name (match legal name), sort code, account number, bank proof upload  
- **Labour (if Labour supplier):** Who employs workers, umbrella/subcontractor name + CRN, subcontracting yes/no, PAYE/RTW/NMW checkboxes, labour supply chain statement upload  

### Current Codebase Data (Partial)

- **Admin create:** Form has `companyName`, `contactName`, `email`, `phone`, `address`, `city`, `postcode`, `vatNumber`, `companyRegNumber`, `notes`. **Missing:** Supplier type (Labour / Non-labour), explicit “Draft” status.
- **Supplier portal:** Editable fields include contact, address, `vatNumber`, `companyRegNumber`, `bankName`, `sortCode`, `accountNumber`. **Missing:** Registered/trading address split, finance contact, nature of supply, VAT status (VAT Registered vs Not) with path-specific fields, bank proof upload, labour section, any document uploads.

---

## Documents (rules-based)

- **All:** Companies House proof, Bank proof, Signed Supplier Declaration  
- **VAT Registered:** VAT evidence, Sample VAT invoice  
- **Not VAT Registered:** Signed Non-VAT Declaration  
- **Labour supplier:** EL insurance, PL (if required), Right to Work/payroll statement, Labour supply chain statement  

**Current codebase:** Documents exist only for **employees** (`documents` table has `employeeId`). No supplier documents table, no rules-based checklist, no document upload in supplier portal.

---

## Core Rules (Compliance)

1. **VAT change control** — After approval, supplier cannot change VAT status directly; must submit VAT change request; Admin approves before update.  
2. **Bank change control** — After approval, supplier cannot overwrite bank details; must submit bank change request with fresh bank proof (≤3 months); Admin approves.  
3. **Labour chain** — Labour suppliers using Umbrella/Subcontractor must provide name + CRN and signed labour supply chain statement.  
4. **Audit trail** — Created/submitted/approved/Info Required/Suspended, document uploads (with versions), VAT and bank change requests (old/new, decision, approver, timestamp).

**Current codebase:** VAT and bank changes go through a **generic pending-change** flow (single payload, approve/reject). No dedicated “VAT change request” or “bank change request” type; no “fresh bank proof” or 3-month rule; no labour chain fields.

---

# User Stories with Codebase Validation

---

## Story 1 — Admin creates supplier and sends portal invite

**As Admin**, I create a limited company supplier using Legal Name, CRN, Email, and Supplier Type, so I can invite them to complete onboarding.

### Acceptance criteria

- Supplier record is created with **Status = Draft**
- Supplier receives a portal access invite link to the provided email
- Audit trail includes **Created date/time + created by (Admin)**

### Codebase status: **Partial / Different**

| Criterion | Status | Notes |
|-----------|--------|--------|
| Supplier record created | ✅ Implemented | `POST /api/suppliers` in `server/routes.ts`; `storage.createSupplier` in `server/storage.ts`. Form in `client/src/pages/suppliers.tsx` |
| Status = Draft | ❌ Different | New suppliers get **status = `pending`** (schema default). No `Draft` in enum |
| Portal invite link to email | ✅ Implemented | `POST /api/suppliers/:id/send-invitation`; invitation token and flow in `server/routes.ts`; `supplierInvitations` table |
| Audit: Created + created by | ✅ Implemented | `supplier_created` audit log with `entityId`, `details`; `createdBy` not stored on supplier row but can be inferred from audit |

**To align:** Add `Draft` to supplier status (or map “Draft” to current `pending` and document it). Add **Supplier type** (Labour / Non-labour) to schema and admin create form.

---

## Story 2 — Supplier completes company profile (limited company)

**As Supplier**, I complete my company profile details so my onboarding record is accurate and ready for review.

### Acceptance criteria

- Registered office address is entered
- Trading address is entered (or marked “same as registered”)
- Main contact and finance contact details are entered
- Nature of supply is entered
- Required fields validation prevents missing mandatory values

### Codebase status: **Partial**

| Criterion | Status | Notes |
|-----------|--------|--------|
| Registered office address | ❌ Not implemented | Single `address`, `city`, `postcode` on supplier; no registered vs trading split |
| Trading address / same as registered | ❌ Not implemented | Not in schema or portal |
| Main contact | ✅ Implemented | `contactName`, `phone` in portal (`client/src/pages/supplier-portal.tsx`) |
| Finance contact | ❌ Not implemented | No finance contact name/email in schema or portal |
| Nature of supply | ❌ Not implemented | Not in schema or portal |
| Required-field validation | ⚠️ Partial | Portal allows saving; no onboarding-specific validation or “required for submit” rules |

**To align:** Add `registeredOfficeAddress`, `tradingAddress` (or “same as registered”), `financeContactName`, `financeContactEmail`, `natureOfSupply` to schema and supplier portal form; add validation for mandatory fields before submit.

---

## Story 3 — Supplier selects VAT path and completes it

**As Supplier**, I select my VAT status and complete the required VAT information so you can assess my VAT position.

### Acceptance criteria

- Supplier selects **VAT Registered** or **Not VAT Registered**
- **VAT Registered:** VAT number, VAT evidence and sample VAT invoice uploaded
- **Not VAT Registered:** Reason selected, “No VAT charged + notify if status changes” checkbox, Signed Non-VAT Declaration uploaded
- System blocks submission until the chosen VAT path is fully complete

### Codebase status: **Not implemented**

| Criterion | Status | Notes |
|-----------|--------|--------|
| VAT status selection | ❌ Not implemented | Only `vatNumber` (text) on `suppliers`; no VAT Registered vs Not VAT Registered |
| VAT path fields (number, evidence, invoice) | ❌ Not implemented | No VAT evidence or sample invoice upload; no supplier documents |
| Non-VAT path (reason, checkbox, declaration) | ❌ Not implemented | Not in schema or UI |
| Block submit until VAT path complete | ❌ Not implemented | No onboarding submit or path-based validation |

**To align:** Add VAT status enum and path-specific fields; add document types for VAT evidence, sample invoice, Non-VAT declaration; implement rules-based completion checks before submit.

---

## Story 4 — Supplier enters bank details and uploads bank proof

**As Supplier**, I provide bank details and upload evidence so payments can be set up correctly.

### Acceptance criteria

- Account name, sort code, and account number are completed
- Account name must match supplier legal name (validation + warning if mismatch)
- Bank proof is uploaded showing supplier name + account details
- System blocks submission until bank proof is uploaded

### Codebase status: **Partial**

| Criterion | Status | Notes |
|-----------|--------|--------|
| Account name, sort code, account number | ✅ Implemented | `bankName`, `sortCode`, `accountNumber` in schema and supplier portal |
| Account name match legal name | ❌ Not implemented | No validation or warning against `companyName` |
| Bank proof upload | ❌ Not implemented | No supplier documents; no bank proof type |
| Block submit until bank proof | ❌ Not implemented | No document checklist or submit gate |

**To align:** Add “account name = legal name” validation (and warning). Add supplier document storage and bank proof document type; require bank proof before submit.

---

## Story 5 — Supplier completes labour section (Labour suppliers only)

**As Supplier**, if I am a Labour supplier, I provide labour supply details so you can confirm the labour chain and compliance controls.

### Acceptance criteria

- Section appears only when Supplier Type = Labour supplier
- “Who employs workers” (Supplier / Umbrella / Subcontractor); if Umbrella: name + CRN; if Subcontractor or subcontracting = Yes: Subcontractor name + CRN
- PAYE / RTW / NMW compliance checkboxes
- Labour supply chain statement uploaded (signed)
- Required labour docs (EL insurance, PL if required)

### Codebase status: **Not implemented**

| Criterion | Status | Notes |
|-----------|--------|--------|
| Supplier type = Labour / Non-labour | ❌ Not implemented | No supplier type in schema or UI |
| Labour section visibility | ❌ Not implemented | No labour block in portal |
| Who employs workers + Umbrella/Subcontractor + CRN | ❌ Not implemented | Not in schema |
| PAYE / RTW / NMW checkboxes | ❌ Not implemented | Not in schema or portal |
| Labour supply chain statement + docs | ❌ Not implemented | No supplier documents or labour-specific doc types |

**To align:** Add `supplierType` (Labour / Non-labour); add labour-specific columns and labour document types; show labour section only for Labour suppliers; add document upload and checklist.

---

## Story 6 — Supplier uploads required documents (rules-based checklist)

**As Supplier**, I upload all required documents so Admin can verify compliance.

### Acceptance criteria

- Document checklist changes automatically based on VAT status and Supplier type
- Supplier cannot click Submit until all required documents are uploaded
- Each upload stores filename, timestamp, uploader, and version

### Codebase status: **Not implemented**

| Criterion | Status | Notes |
|-----------|--------|--------|
| Rules-based document checklist | ❌ Not implemented | No supplier documents; employee docs have no rules-based checklist |
| Submit blocked until required docs | ❌ Not implemented | No supplier onboarding submit or doc gates |
| Filename, timestamp, uploader, version | ❌ Not implemented | `documents` table is employee-only; no versioning |

**To align:** Introduce supplier documents (table or scope) and document type enum/config; implement rules (VAT path + supplier type) to derive required list; add version and uploader/timestamp; gate Submit on checklist completion.

---

## Story 7 — Supplier submits onboarding

**As Supplier**, I submit my onboarding once everything is complete so Admin can review and approve.

### Acceptance criteria

- Supplier clicks **Submit**
- Status changes to **Submitted**
- Supplier cannot edit locked sections after submission (except if Info Required)
- Audit trail includes **Submitted date/time + submitted by (Supplier)**

### Codebase status: **Different / Not implemented**

| Criterion | Status | Notes |
|-----------|--------|--------|
| Submit button / action | ⚠️ Different | Portal has “request changes” (pending-change flow), not “Submit onboarding” |
| Status = Submitted | ❌ Not implemented | No `Submitted` status; no transition from Draft → Submitted |
| Lock sections after submit | ❌ Not implemented | No onboarding state or section locking |
| Audit: Submitted + submitted by | ❌ Not implemented | No `onboarding_submitted`-style event for suppliers |

**To align:** Add “Submit onboarding” action in supplier portal; add status **Submitted** (and Draft) to supplier lifecycle; lock sections when status = Submitted unless Info Required; log `supplier_onboarding_submitted` with timestamp and user.

---

## Story 8 — Admin reviews and approves or requests info

**As Admin**, I review the supplier’s submitted profile and documents so I can either approve onboarding or request corrections.

### Acceptance criteria

- Admin can view all fields and documents in a single review screen
- Admin can add review notes
- Admin selects **Approve** → Status = Approved, audit “Approved”; or **Request Info** → Status = Info Required, notes to supplier, audit “Info Required”
- Supplier receives notification of decision and notes (if any)

### Codebase status: **Partial**

| Criterion | Status | Notes |
|-----------|--------|--------|
| View all fields and documents | ⚠️ Partial | Supplier detail shows fields; no supplier documents to view |
| Review notes | ⚠️ Partial | `notes` on supplier; no dedicated “review notes” or “info required” notes |
| Approve → Approved | ✅ Implemented | `PATCH /api/suppliers/:id/approve` sets status `approved`; audit `supplier_approved` |
| Request Info → Info Required | ❌ Not implemented | No “Request Info” action or **Info Required** status |
| Notify supplier of decision/notes | ❌ Not implemented | No in-app/email notification for approval or info request |

**To align:** Add **Info Required** status and “Request Info” action with notes; store and show “info required” notes; add notification (in-app or email) when Admin approves or requests info.

---

## Story 9 — Supplier fixes issues and resubmits

**As Supplier**, when Admin requests information, I correct missing fields/documents and resubmit.

### Acceptance criteria

- Status = Info Required unlocks sections (or all sections)
- Supplier makes changes and uploads missing documents
- Supplier clicks **Resubmit** → Status back to **Submitted**
- Audit: **Resubmitted date/time + submitted by (Supplier)**

### Codebase status: **Not implemented**

| Criterion | Status | Notes |
|-----------|--------|--------|
| Info Required unlocks sections | ❌ Not implemented | No Info Required status or unlock logic |
| Resubmit → Submitted | ❌ Not implemented | No Resubmit action or status transition |
| Audit: Resubmitted | ❌ Not implemented | No such event |

**To align:** Implement Info Required status; allow edit when Info Required; add “Resubmit” button and transition to Submitted; log `supplier_onboarding_resubmitted`.

---

## Story 10 — Supplier requests VAT status change (after approval)

**As Supplier**, I request a VAT status change so Admin can approve it before any VAT details are updated.

### Acceptance criteria

- Supplier creates a **VAT change request** (cannot directly edit VAT status)
- Supplier uploads supporting evidence (VAT cert + number if becoming registered; Non-VAT declaration + reason + checkbox if becoming non-VAT)
- Status remains **Approved** unless Admin decides otherwise
- Admin approves/rejects; system stores old value, new value, decision, approver, timestamp in audit

### Codebase status: **Partial (generic change flow)**

| Criterion | Status | Notes |
|-----------|--------|--------|
| VAT change request (no direct edit) | ⚠️ Partial | All profile changes (including `vatNumber`) go through **generic** `supplierPendingChanges`; no dedicated “VAT change request” |
| Supporting evidence (VAT/Non-VAT docs) | ❌ Not implemented | Pending change payload has no document attachments or evidence types |
| Old/new value, decision, approver, timestamp | ⚠️ Partial | Audit has `supplier_change_approved` / `supplier_change_rejected`; payload has new values; old value and “VAT-specific” audit structure not explicit |

**To align:** Introduce explicit **VAT change request** (type or separate table) with evidence uploads; prevent direct VAT status edit when Approved; audit with old VAT status, new VAT status, decision, approver, timestamp.

---

## Story 11 — Supplier requests bank detail change (after approval)

**As Supplier**, I request a bank detail change so Admin can approve it before payment details are updated.

### Acceptance criteria

- Supplier creates a **Bank change request** (cannot directly edit bank details)
- Supplier uploads **fresh bank proof** (dated within last 3 months)
- Admin approves/rejects
- System stores old value, new value, decision, approver, timestamp in audit

### Codebase status: **Partial (generic change flow)**

| Criterion | Status | Notes |
|-----------|--------|--------|
| Bank change request (no direct edit) | ⚠️ Partial | Bank fields in generic pending-change flow; no dedicated “bank change request” |
| Fresh bank proof (≤3 months) | ❌ Not implemented | No document upload on change request; no date check |
| Old/new, decision, approver, timestamp | ⚠️ Partial | Same as Story 10; generic approve/reject audit |

**To align:** Introduce **Bank change request** with required “fresh bank proof” upload and date validation (≤3 months); block direct bank edit when Approved; audit old/new bank details, decision, approver, timestamp.

---

## Story 12 — Admin suspends supplier (risk control)

**As Admin**, I suspend a supplier if risk issues appear so no work/payments proceed until resolved.

### Acceptance criteria

- Admin sets supplier to **Suspended** with reason and notes
- Supplier portal access remains available but supplier cannot submit changes (unless allowed)
- Audit: **Suspended date/time + suspended by + reason**
- Admin can later un-suspend (optional) → back to Approved

### Codebase status: **Partial**

| Criterion | Status | Notes |
|-----------|--------|--------|
| Set status = Suspended | ⚠️ Partial | Schema has `suspended` in enum; `PATCH /api/suppliers/:id` can set `status`; **no UI** (no Suspend button or status dropdown on detail/list) |
| Reason and notes | ⚠️ Partial | `notes` exists; no dedicated “suspension reason” field |
| Portal access / block submit | ❌ Not implemented | No logic to block supplier actions when suspended |
| Audit: Suspended + by + reason | ❌ Not implemented | No `supplier_suspended` audit event |
| Un-suspend to Approved | ⚠️ Partial | API can set status back; no dedicated “Unsuspend” action or audit |

**To align:** Add Suspend (and optional Unsuspend) in admin UI; add suspension reason and store in notes or dedicated field; enforce “no submit when suspended” in portal; log `supplier_suspended` / `supplier_unsuspended` with timestamp, user, reason.

---

## Story 13 — Periodic review reminders (simple schedule)

**As Admin**, I perform periodic reviews so supplier compliance remains current.

### Acceptance criteria

- Labour suppliers: review every **3 months**; Non-labour: every **12 months**
- Event-driven review when: Bank change request submitted, VAT change request submitted, Labour chain changes (umbrella/subcontracting introduced)
- Review completion logged in audit (review date + reviewer)

### Codebase status: **Not implemented**

| Criterion | Status | Notes |
|-----------|--------|--------|
| 3/12 month schedule by supplier type | ❌ Not implemented | No supplier type; no review schedule or reminder job |
| Event-driven review triggers | ❌ Not implemented | No events or flags for “review needed” on change requests or labour chain |
| Review completion in audit | ❌ Not implemented | No “review completed” event or reviewer/date storage |

**To align:** Add supplier type and review interval; add scheduled job or reminder for next review date; set “review required” on bank/VAT change request and labour chain change; add “Complete review” action and audit event (review date + reviewer).

---

# Minimum Audit Trail — Required vs Current

## Required (from user stories)

| Event | Required data |
|-------|----------------|
| Created | Created date + created by (Admin) |
| Submitted | Submitted date + submitted by (Supplier) |
| Approved / Info Required / Suspended | Date + who (Admin) |
| Document uploads | Filename, version, uploader, timestamp |
| VAT change request | Old value, new value, decision, approver, timestamp |
| Bank change request | Old value, new value, decision, approver, timestamp |

## Current implementation

| Event | Status | Notes |
|-------|--------|--------|
| Created | ✅ | `supplier_created` with entityId, details (e.g. companyName); createdBy can be taken from request user |
| Submitted | ❌ | No supplier onboarding submit event |
| Approved | ✅ | `supplier_approved` with entityId |
| Info Required | ❌ | No status or event |
| Suspended | ❌ | No `supplier_suspended` event |
| Document uploads | ❌ | No supplier documents; employee document create not audited |
| VAT change request | ⚠️ | Generic `supplier_change_approved` / `supplier_change_rejected`; no explicit old/new VAT or “VAT change” event |
| Bank change request | ⚠️ | Same as VAT; no dedicated bank change audit with old/new |

**To align:** Add audit events for Submitted, Info Required, Suspended (and Unsuspended); add document upload audit (filename, version, uploader, timestamp); add dedicated VAT and bank change request audit entries with old/new values, decision, approver, timestamp.

---

# Summary: What’s done vs what’s needed

| Area | Implemented | To do |
|------|-------------|--------|
| **Status model** | pending / approved / active / suspended / terminated | Add Draft, Submitted, Info Required (or map and document); align with stories |
| **Admin: create supplier** | Yes (no supplier type, no Draft) | Add supplier type; set or map to Draft |
| **Admin: approve** | Yes | Keep; add Request Info and Info Required |
| **Admin: suspend** | API only | Add UI (Suspend/Unsuspend), reason, audit, portal behaviour |
| **Portal invite** | Yes | Keep |
| **Supplier profile** | Basic contact, address, bank, VAT number | Add registered/trading address, finance contact, nature of supply, VAT path (Registered vs Not), labour section (when Labour type) |
| **Bank details** | Yes (no proof, no match validation) | Account name match legal name; bank proof upload; block submit until proof |
| **Documents** | Employee only | Supplier documents table/types; rules-based checklist; versioning; audit uploads |
| **Submit / Resubmit onboarding** | No | Submit → Submitted; lock sections; Resubmit when Info Required; audit |
| **VAT / Bank change requests** | Generic pending changes | Dedicated VAT and Bank change requests; evidence (e.g. fresh bank proof); explicit audit |
| **Labour supplier** | No | Supplier type; labour section and docs; labour chain (Umbrella/Subcontractor + CRN) |
| **Periodic review** | No | Schedule (3/12 months); event-driven triggers; review completion audit |
| **Audit trail** | Supplier lifecycle + change approve/reject | Add Submitted, Info Required, Suspended; document uploads; VAT/Bank change old/new + decision + approver |

This file should be used as the single reference for the 13 user stories and their implementation status in the Guardosmart codebase.
