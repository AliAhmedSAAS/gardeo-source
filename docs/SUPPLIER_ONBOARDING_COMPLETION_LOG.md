# Supplier Onboarding — Completion Log

This log tracks implementation progress against the user stories in `SUPPLIER_ONBOARDING_USER_STORIES.md`.  
**Last updated:** 2025-02-21 (validated against codebase).

---

## Validation summary (2025-02-21)

| Story | Verified in codebase |
|-------|----------------------|
| 1 | `shared/schema.ts`: `supplierStatusEnum` includes `draft`; default `status = "draft"`; `supplierTypeEnum` (labour/non_labour). Admin: `suppliers.tsx` supplier type; `POST /api/suppliers/:id/send-invitation`. |
| 2 | Portal: registered/trading address, finance contact, nature of supply. `shared/supplierOnboardingValidation.ts`: `isCompanyProfileComplete()`; used in portal + submit-onboarding. |
| 3 | Portal: VAT status select, vatNumber, nonVatReason, nonVatDeclarationAccepted. Required docs: vat_evidence, sample_vat_invoice, non_vat_declaration. Validation: `isVatPathComplete()`; submit gated. |
| 4 | Portal: accountName, sortCode, accountNumber; account name mismatch warning. `bank_proof` in required docs; `isBankDetailsComplete()`. |
| 5 | Portal: labour section when `supplierType === "labour"`; whoEmploysWorkers, umbrella/subcontractor, checkboxes. Required docs: el_insurance, pl_insurance, rtw_payroll_statement, labour_supply_chain_statement. `isLabourSectionComplete()`. |
| 6 | `shared/supplierRequiredDocs.ts`: `getRequiredSupplierDocumentTypes`, checklist UI in portal; server validates on submit-onboarding. |
| 7 | `POST /api/supplier-portal/submit-onboarding` → status submitted, audit `supplier_onboarding_submitted`; portal `canEdit` only when draft/info_required. |
| 8 | Admin: Request Info (`PATCH request-info`), Approve; supplier detail shows notes. Notify supplier (email/in-app) **TBD**. |
| 9 | canEdit when info_required; resubmit uses same submit-onboarding endpoint. |
| 10 | Portal: Request VAT change dialog; PATCH me with changeType `vat`, evidenceDocumentIds; audit `supplier_vat_change_approved/rejected`. |
| 11 | Portal: Request bank change; bankProofDocumentId ≤3 months; audit `supplier_bank_change_approved/rejected`. |
| 12 | Admin: Suspend/Unsuspend, suspensionReason; portal 403 on submit when suspended; audit `supplier_suspended`/`supplier_unsuspended`. |
| 13 | `PATCH /api/suppliers/:id/complete-review`; lastReviewAt, nextReviewDueAt (3/12 months by type). Scheduled reminder job **TBD**. |

---

## Legend

| Symbol | Meaning |
|-------|--------|
| ✅ | Completed |
| 🟡 | In progress |
| ⬜ | Not started |

---

## Stories Overview

| # | Story | Status | Notes |
|---|-------|--------|--------|
| 1 | Admin creates supplier and sends portal invite | ✅ | Status=Draft, Supplier type added; invite existing |
| 2 | Supplier completes company profile (limited company) | ✅ | Registered/trading address, finance contact, nature of supply in portal |
| 3 | Supplier selects VAT path and completes it | ✅ | VAT status + path fields; submit gated until VAT path complete (client + server) |
| 4 | Supplier enters bank details and uploads bank proof | ✅ | Account name + match warning; bank proof required via docs; submit gated (client + server) |
| 5 | Supplier completes labour section (Labour suppliers only) | ✅ | Labour section in portal when type=labour; fields + checkboxes |
| 6 | Supplier uploads required documents (rules-based checklist) | ✅ | Rules-based checklist UI; submit blocked until required docs |
| 7 | Supplier submits onboarding | ✅ | Submit → Submitted, audit; section lock when submitted |
| 8 | Admin reviews and approves or requests info | ✅ | Request Info, Info Required, review notes; Approve existing; notify supplier TBD |
| 9 | Supplier fixes issues and resubmits | ✅ | Edit when Info Required; Resubmit = submit again (same endpoint) |
| 10 | Supplier requests VAT status change (after approval) | ✅ | Dedicated VAT change request; evidence docs; audit old/new, decision |
| 11 | Supplier requests bank detail change (after approval) | ✅ | Dedicated bank change request; fresh bank proof ≤3 months; audit |
| 12 | Admin suspends supplier (risk control) | ✅ | Suspend/Unsuspend UI, reason, audit; portal block when suspended |
| 13 | Periodic review reminders | ✅ | Complete review action + audit; next due 3/12 months; scheduled reminder job TBD |

---

## Detailed Checklist (per story)

### Story 1 — Admin creates supplier and sends portal invite
- [x] Supplier record created with **Status = Draft** (default in schema + API)
- [x] **Supplier type** (Labour / Non-labour) in schema and admin create form
- [x] Portal invite link sent to email (existing)
- [x] Audit: Created date/time + created by (details.createdBy in audit)

### Story 2 — Supplier completes company profile
- [x] Registered office address
- [x] Trading address (or "same as registered")
- [x] Main contact (existing)
- [x] Finance contact name/email
- [x] Nature of supply
- [x] Required-field validation for submit (client + server via shared/supplierOnboardingValidation)

### Story 3 — VAT path
- [x] VAT status: VAT Registered / Not VAT Registered
- [x] VAT Registered: number (evidence/sample invoice via supplier docs)
- [x] Not VAT Registered: reason, checkbox, Non-VAT declaration upload (doc type exists)
- [x] Block submit until VAT path complete (client + server validation)

### Story 4 — Bank details and proof
- [x] Account name, sort code, account number (existing + accountName)
- [x] Account name match legal name validation/warning
- [x] Bank proof upload (supplier document type bank_proof)
- [x] Block submit until bank proof uploaded (required docs + bank details validation)

### Story 5 — Labour section
- [x] Supplier type Labour/Non-labour
- [x] Labour section visible only when Labour
- [x] Who employs workers; Umbrella/Subcontractor name + CRN
- [x] PAYE / RTW / NMW checkboxes
- [x] Labour supply chain statement + EL/PL docs (required doc types + checklist; submit gated by labour section completeness)

### Story 6 — Documents checklist
- [x] Supplier documents table + types
- [x] Rules-based checklist (VAT + supplier type) — UI shows required list; server validates on submit
- [x] Submit blocked until required docs uploaded
- [x] Filename, timestamp, uploader, version per upload (version in schema)

### Story 7 — Supplier submits onboarding
- [x] Submit button/action
- [x] Status → Submitted
- [x] Lock sections after submit (unless Info Required) — canEdit only when draft/info_required
- [x] Audit: Submitted date/time + submitted by

### Story 8 — Admin approves or requests info
- [x] Review screen: all fields + documents (documents API added; detail shows notes)
- [x] Review notes / info required notes (infoRequiredNotes + Request Info dialog)
- [x] Approve → Approved (existing)
- [x] Request Info → Info Required status + notes
- [ ] Notify supplier of decision/notes (email/in-app TBD)

### Story 9 — Supplier resubmits
- [x] Info Required unlocks sections (canEdit when info_required)
- [x] Resubmit → Status Submitted (same Submit onboarding endpoint)
- [x] Audit: Resubmitted (same supplier_onboarding_submitted event)

### Story 10 — VAT change request (after approval)
- [x] VAT change request (no direct edit when Approved; Request VAT change in portal)
- [x] Supporting evidence upload (evidenceDocumentIds; upload allowed for approved suppliers)
- [x] Audit: old/new value, decision, approver, timestamp (supplier_vat_change_approved/rejected)

### Story 11 — Bank change request (after approval)
- [x] Bank change request (no direct edit when Approved; Request bank change in portal)
- [x] Fresh bank proof ≤3 months (validated on request and on document upload eligibility)
- [x] Audit: old/new, decision, approver, timestamp (supplier_bank_change_approved/rejected)

### Story 12 — Admin suspends supplier
- [x] Suspend (and Unsuspend) in admin UI
- [x] Suspension reason/notes (suspensionReason, dialog)
- [x] Portal: block submit when suspended (server 403; portal banner)
- [x] Audit: supplier_suspended / supplier_unsuspended

### Story 13 — Periodic review reminders
- [x] Review interval by supplier type (3/12 months) — Complete review sets next due; Labour 3 months, Non-labour 12 months
- [ ] Event-driven review triggers (scheduled reminder job TBD)
- [x] Review completion audit (supplier_review_completed; lastReviewAt, nextReviewDueAt on supplier)

---

## Implementation log (chronological)

- **Started:** Log created; schema and Story 1–2 implementation in progress.
- **Schema:** Added `supplierStatusEnum` values (draft, submitted, info_required), `supplierTypeEnum` (labour, non_labour), `supplierDocumentTypeEnum` and `supplierDocuments` table; extended `suppliers` with company profile, VAT, labour, submission/suspension fields; default status = draft.
- **API:** POST /api/suppliers sets status=draft, createdBy; PATCH request-info, suspend, unsuspend; GET/POST supplier documents; supplier-portal PATCH allows direct profile when draft/info_required; POST supplier-portal/submit-onboarding; GET/POST supplier-portal/documents.
- **Admin:** Add Supplier form includes Supplier type; list/detail show draft, submitted, info_required; Approve for pending/submitted; Request Info dialog; Suspend/Unsuspend with reason.
- **Portal:** Full company profile (registered/trading, finance contact, nature of supply), VAT path (VAT Registered / Not + fields), bank (account name + mismatch warning), labour section when type=labour, Submit onboarding, document count.
- **Migration:** `npx drizzle-kit generate` produced `migrations/0000_kind_gwen_stacy.sql`. If DB already exists, add a manual migration that only adds new enum values and columns to `suppliers` and creates `supplier_documents`.
- **Story 12:** Portal block when suspended: server returns 403 on submit-onboarding when status=suspended; portal shows suspended banner and status message.
- **Story 6:** Rules-based document checklist: added `shared/supplierRequiredDocs.ts` (getRequiredSupplierDocumentTypes, hasAllRequiredDocuments, SUPPLIER_DOC_LABELS); portal shows required-docs checklist and gates Submit until all uploaded; server validates required docs on submit-onboarding.
- **Stories 10 & 11:** Dedicated VAT and Bank change requests: PATCH supplier-portal/me accepts changeType 'vat' (with evidenceDocumentIds) or 'bank' (with bankProofDocumentId, validated ≤3 months); approve/reject handlers write supplier_vat_change_approved/rejected and supplier_bank_change_approved/rejected with old/new, decision, approver; portal "Request VAT change" / "Request bank change" dialogs when approved/active; approved suppliers can upload bank_proof, vat_evidence, sample_vat_invoice, non_vat_declaration for change requests.
- **Story 13:** Periodic review: suppliers schema lastReviewAt, lastReviewBy, nextReviewDueAt; PATCH /api/suppliers/:id/complete-review; audit supplier_review_completed; admin "Complete review" button and review due display on supplier detail. Run `npx drizzle-kit generate` for migration for new columns.
- **Submit validation (Stories 2–5):** Added `shared/supplierOnboardingValidation.ts`: isCompanyProfileComplete, isVatPathComplete, isBankDetailsComplete, isLabourSectionComplete, getSubmitOnboardingReadiness. Portal gates Submit on readiness (effective supplier = supplier + form when editing); server validates readiness on POST submit-onboarding and returns 400 with message/missingDocumentTypes if not ready. Completes optional required-field validation, block-submit-until-VAT-path-complete, block-submit-until-bank-proof, and labour section completeness for submit.
- **2025-02-21:** Completion log validated against codebase. Added validation summary table (per-story verification). All 13 stories confirmed complete except: Story 8 — notify supplier of decision (email/in-app TBD); Story 13 — event-driven/scheduled review reminder job TBD.
