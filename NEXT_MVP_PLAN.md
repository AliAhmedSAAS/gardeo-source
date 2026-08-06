# Gardeo Self-Billing MVP - Next Steps

## Completed Features

### Phase 1: Core Schema & Backend
- Invoice, invoice line items, rate card, dispute, credit/debit note tables
- Credit/debit note line items tables
- Full CRUD storage methods and API endpoints
- Configurable VAT rates per supplier (defaultVatRate field)

### Phase 2: Frontend Pages
- Admin Supplier Timesheets (approve/reject shifts for billing)
- Dispute Management (create, escalate, resolve disputes with messaging)
- Self-Billing Invoices (generate, issue, track, pay invoices)
- Supplier Invoice Portal (view, accept, dispute invoices)
- Self-Billing Audit Pack (compliance dashboard, VAT summary, CSV export)

### Phase 3: Business Logic
- Dispute locks shifts from invoicing
- Already-invoiced shift tracking via line items
- Dispute resolution resets shifts to pending
- Invoice lifecycle: draft > issued > accepted > paid
- Supplier acceptance/dispute with notifications
- Credit/debit notes with line items and PDF generation

### Phase 4: PDF Generation & Compliance
- PDFKit-based generators for invoices, credit notes, debit notes
- HMRC mandatory statement on all self-billed invoices
- PDF download from admin and supplier portals
- Audit pack with period filtering and compliance checklist

## Recommended Next Steps

### Priority 1: Testing & Validation
- End-to-end testing of complete invoice lifecycle
- VAT calculation verification with edge cases
- Multi-tenant isolation testing
- PDF rendering verification across browsers

### Priority 2: Enhanced Rate Card Management
- Bulk rate card import from CSV
- Rate card version history and comparison
- Automatic rate card expiry notifications
- Rate card approval workflow

### Priority 3: Payment Integration
- Bank payment file generation (BACS/Faster Payments)
- Payment reconciliation against invoices
- Automated payment reminders
- Payment aging reports

### Priority 4: Reporting Enhancements
- VAT return preparation reports (quarterly/monthly)
- Supplier payment history reports
- Dispute resolution metrics and SLA tracking
- Revenue forecasting based on rate cards and scheduling

### Priority 5: Advanced Compliance
- Self-billing agreement renewal reminders
- Supplier VAT number validation via HMRC API
- Automated self-billing agreement PDF generation with e-signatures
- HMRC Making Tax Digital (MTD) integration readiness
