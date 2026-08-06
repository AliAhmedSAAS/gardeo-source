# HMRC VAT Notice 700/62 Compliance Checklist

## Self-Billing Arrangement Requirements

### 1. Written Agreement (Section 4)
- [x] Written self-billing agreement between buyer and supplier
- [x] Agreement stored and viewable in system (Supplier Portal > Self-Billing Agreement)
- [x] Agreement status tracked per supplier (active/pending/expired)

### 2. Invoice Requirements (Section 5)
- [x] Sequential invoice numbering (SBI-YYYYMM-NNNN format)
- [x] Buyer's name, address, and VAT registration number on invoices
- [x] Supplier's name, address, and VAT registration number on invoices
- [x] Date of issue clearly shown
- [x] Supply period (start/end dates) specified
- [x] Line-item detail with description, hours, rate, subtotal
- [x] VAT rate and amount per line item
- [x] Total excluding VAT, VAT amount, and total including VAT
- [x] Mandatory HMRC statement: "The VAT shown is your output tax due to HMRC"

### 3. VAT Treatment (Section 6)
- [x] Configurable VAT rate per supplier (defaultVatRate field)
- [x] Support for VAT-registered and non-VAT-registered suppliers
- [x] VAT calculated per line item, not just invoice total
- [x] Zero-rate option for non-VAT-registered suppliers

### 4. Credit Notes (Section 7)
- [x] Credit note generation linked to original invoice
- [x] Sequential credit note numbering (CN-YYYYMM-NNNN)
- [x] Reference to original invoice maintained
- [x] Credit note line items with VAT breakdown
- [x] PDF generation with full details

### 5. Debit Notes (Section 7)
- [x] Debit note generation linked to original invoice
- [x] Sequential debit note numbering (DN-YYYYMM-NNNN)
- [x] Reference to original invoice maintained
- [x] Debit note line items with VAT breakdown
- [x] PDF generation with full details

### 6. Supplier Acceptance (Section 8)
- [x] Supplier can view invoices issued to them
- [x] Accept/dispute workflow with audit trail
- [x] Dispute locks shifts from further invoicing
- [x] Dispute resolution resets shifts to pending for re-approval
- [x] Notifications sent to finance team on acceptance/dispute

### 7. Record Keeping (Section 9)
- [x] Full audit trail of all financial actions
- [x] Invoice lifecycle tracked (draft > issued > accepted > paid)
- [x] Dispute history with messages and resolution
- [x] Audit pack page with period filtering and CSV export
- [x] Compliance checklist dashboard

### 8. Rate Card Management
- [x] Per-supplier, per-site, per-role rate cards
- [x] Effective date ranges for rate cards
- [x] Rate cards used in invoice generation
- [x] Historical rate card preservation

## System Controls

### Shift Locking
- Shifts with open disputes are excluded from invoice generation
- Already-invoiced shifts cannot be re-invoiced (tracked via line items table)
- Dispute resolution resets shift status to allow re-approval flow

### Invoice Lifecycle
- Draft: Invoice created but not yet issued
- Issued: Invoice sent to supplier with issuedAt timestamp and issuedBy user
- Accepted: Supplier has confirmed amounts are correct
- Disputed: Supplier has raised a dispute (triggers notification to finance)
- Paid: Payment confirmed with paidAt timestamp

### PDF Generation
- Self-billed invoices include mandatory HMRC VAT statement
- Credit notes reference original invoice number
- All PDFs include buyer and supplier VAT details
- Download available from admin Self-Billing page and Supplier Portal
