# Open Questions - Self-Billing Implementation

## Business Rules

### 1. Self-Billing Agreement Renewal
- What is the standard agreement renewal period? (typically 12 months per HMRC guidance)
- Should the system automatically expire agreements and block invoicing?
- Who is authorized to renew agreements — tenant admin only or operations managers too?

### 2. VAT Rate Changes
- How should mid-period VAT rate changes be handled for invoices spanning the change date?
- Should the system support different VAT rates per line item within the same invoice?
- How to handle supplier VAT deregistration mid-contract?

### 3. Dispute Resolution SLA
- What is the target SLA for dispute resolution?
- Should escalated disputes auto-notify senior management after a threshold period?
- Can disputed invoices be partially resolved (some line items accepted, others disputed)?

### 4. Payment Terms
- What are the standard payment terms? (30 days, 14 days, etc.)
- Should the system support early payment discounts?
- How should overdue invoice reminders be configured?

## Technical Questions

### 5. PDF Storage
- Should generated PDFs be stored persistently in object storage, or generated on demand?
- If stored, what is the retention policy for audit compliance? (HMRC requires 6 years)
- Should PDFs include digital signatures or watermarks?

### 6. Multi-Currency
- Is multi-currency support needed for international suppliers?
- If yes, what exchange rate source should be used?
- How should currency conversion interact with VAT calculations?

### 7. Integration Points
- Will the system need to integrate with accounting software (Xero, QuickBooks, Sage)?
- Is BACS payment file generation required?
- Should invoice data be exportable in HMRC MTD-compatible format?

### 8. Rate Card Complexity
- Should rate cards support bank holiday multipliers?
- Should weekend/night shift premium rates be configurable separately?
- How should travel/expense allowances be handled in self-billing?

## Data Migration

### 9. Historical Data
- Will historical invoices from a previous system need to be imported?
- If so, what format will they be in?
- Should imported invoices maintain their original numbering sequence?

### 10. Supplier Onboarding
- What is the process for getting existing suppliers to sign self-billing agreements?
- Should the system support bulk agreement generation?
- How should suppliers without VAT numbers be handled differently?
