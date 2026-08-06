# Gardeo — Full System Reference

**Enterprise Workforce Management Platform**
*Security Officers | Cleaning | Maintenance | Engineering*

> Multi-tenant | UK-focused | HMRC VAT Compliant | BS7858 | SIA | DBS | GDPR

---

## Architecture

| Layer | Technology |
|---|---|
| Frontend | React 18 + TypeScript, Wouter routing, Shadcn UI, TailwindCSS, TanStack Query |
| Backend | Express.js + Passport.js (session) + JWT (mobile) |
| Database | PostgreSQL via Drizzle ORM — 103 tables, 59+ composite indexes |
| Multi-tenancy | Every table scoped to `tenant_id`; same person can work across tenants with separate profiles |
| Auth | 15 RBAC roles with granular permission matrix |

### Roles
`super_admin` · `tenant_admin` · `ceo` · `operations_manager` · `regional_manager` · `hr_manager` · `compliance_manager` · `payroll_manager` · `training_manager` · `finance_manager` · `scheduler` · `admin` · `accountant` · `viewer` · `employee`

---

## 1. Scheduling & Operations

### Scheduling (`/scheduling`)
- Drag-and-drop shift builder with day/week/month views
- Shift templates — save a pattern and bulk-apply across a date range
- Bulk create, bulk delete, bulk complete shifts
- Shift code tagging, break minutes, notes, controller notes
- Assign officer + site + supplier in one record
- External ID support for syncing from PHP system

### Control Room (`/control-room`)
- Live real-time monitoring of all active shifts
- Book On / Book Off tracking per shift with timestamps
- Late minutes calculated automatically
- Shift Status Timeline showing each stage
- Site Coverage Dashboard — overall coverage rate in real time
- Shift Handover Notes — officers log handover details on book-off
- Auto-Escalation Rules — configurable triggers (e.g. officer not booked on 15 mins after start → alert supervisor)
- Run escalation manually or on a timer
- Enhanced Incident Workflow with visual progress tracker
- Controller Activity Log — full audit of who did what in the room
- Pre-check data captured per shift (fire exits, keys, equipment)

### Deployment Map (`/deployment-map`)
- Leaflet map showing all active sites
- Officer GPS check-in pins overlaid in real time
- Coverage status colour-coded per site

### Geolocation Check-in / Check-out
- Haversine distance calculation — configurable geofence (default 200 m)
- Configurable time window per tenant
- Distance displayed in admin shift detail and on employee portal
- Historical backfill endpoint for migrated data
- Stores lat/lng and resolved address for both check-in and check-out

### Sites (`/sites`)
- Full CRUD with server-side SQL pagination (high-volume support)
- Site address, postcode, client link, notes, external ID
- Bulk delete
- Site deduplication tooling

---

## 2. Employee & HR Management

### Employees (`/employees`)
- 3,700+ record support with server-side SQL pagination
- Search and filter by status, name, SIA licence, external ID
- Tenant-scoped display IDs (EMP-00001)
- Tabs per employee: Personal · Immigration · Employment History · Documents · Compliance · Pay Rates · Policies · Probation · Absence · Training · Audit Trail · BS7858 Pack

### Employee Profile Detail
- Personal details, gender, nationality, NI number, address, place of birth
- Emergency contacts (multi-record)
- Bank details (masked; change-request workflow for updates)
- Pay rate history with effective dates
- Policy acknowledgement tracker (GDPR, handbook, etc.)
- External ID + last synced indicator

### Immigration Tab
- Structured passport, visa, BRP, and share code data (`employee_immigration` table)
- Expiry countdowns with colour-coded badges: green >90d · amber 30–90d · red <30d

### HR Dashboard (`/hr-dashboard`)
- Headcount summary: total active, starters/leavers this month, contractors vs in-house
- Leave today: who is off + pending requests with inline approve/decline
- Compliance heat map: SIA/DBS/visa/BRP expiring in 30/60/90-day bands with drill-down
- Open cases: active disciplinaries, grievances, open vetting checks
- Probations due this month
- Training overdue / expired

### Disciplinary & Grievance (`/hr-cases`)
- Case types: disciplinary · grievance · capability · appeal
- Status workflow: open → investigation → hearing_scheduled → outcome_given → appealed → closed
- Outcomes: no_action · verbal_warning · written_warning · final_warning · dismissal · upheld · not_upheld
- Visual timeline of all case events
- Hearing date scheduling with in-app notifications
- Appeal deadline auto-calculated (5 working days)
- Document/evidence attachment per case
- Full event audit trail (invitation sent, hearing held, outcome issued, appeal lodged)
- "Open Disciplinary" / "Open Grievance" button directly on employee profile

### Probation Tracking (`/probation`)
- Default period configurable per tenant (default 12 weeks)
- Compliance alerts at 4-week and 1-week marks before review date
- Actions: Pass / Extend (new date) / Fail
- Extended review date tracking
- Auto-creates probation record when applicant is hired via recruitment
- "Probations Due This Month" panel on HR Dashboard

### Absence Management (`/admin/absences`)
- Absence types: sickness · unauthorised · compassionate · paternity · maternity · jury duty · other
- **Bradford Factor:** B = S² × D — traffic light green <36 · amber 36–200 · red >200
- Return-to-work interview logging (flagged as required for sickness > 3 days)
- Monthly calendar view of all team absences by type
- Absence tab on employee profile: history, total days per year, Bradford score
- RTW date auto-populated to today if not supplied
- Currently absent count on HR Dashboard

### Training Records (`/training-matrix`)
- Training types: first aid · manual handling · fire marshal · conflict resolution · SIA refresher · custom
- Expiry badges: green >90d · amber 30–90d · red <30d · expired
- Certificate upload (PDF/image to object storage)
- Bulk assign training type to multiple employees
- **Training matrix grid:** employees × training types, colour-coded completion status
- Expired training triggers the unified compliance alert pipeline
- Employee portal: officers see own training on My Compliance page

### Leave Management
- Leave request submission by employee or admin
- HR approval workflow with review note
- **Leave Balances:** entitlement + carried forward + adjustments − used days
- Default entitlement configurable per tenant (default 28 days incl. bank holidays)
- Year-end carry-forward process with configurable cap per tenant
- Balance shown on admin approval panel and on employee portal My Profile

### Vetting (`/vetting`)
- Check types: DBS · Right to Work · Reference Check · SIA Verification
- Status: pending → in_progress → completed / failed
- Expiry date monitoring with automated compliance alerts
- Results and notes per check, reference number tracked
- DBS renewal cycle calculated from issue date (3-year cycle)

### Employee Deduplication
- Detects duplicate groups by matching on name + SIA licence + NI number
- Side-by-side comparison with confidence scoring
- Select primary record → merge secondaries (all shifts, docs, bank details reassigned)
- Merged records soft-deleted (`is_merged`, `merged_into_id`, `merged_at`)
- Orphaned placeholder record bulk-purge
- All operations logged to `audit_logs`

### Employee Data Mirror Sync
- Full field parity with external PHP system (13,605 records)
- Syncs: place of birth · passport · visa · BRP · share code · employment history · references · documents with external upload dates
- `sanitizeDate()` handles invalid dates from legacy PHP API (e.g. `-0001-11-30`)
- `external_id` tracked on employees, sites, shifts for sync integrity
- Overwrite strategy (not fill-blanks) for clean data parity

---

## 3. Recruitment

### Recruitment Pipeline (`/recruitment`)
- Job postings with **AI-generated descriptions** (OpenAI)
- Applicant pipeline: Applied → Screening → Interview → Offer → Hired / Rejected
- Interview scheduling with date/time, location/video link, interviewer assignment
- In-app notification to interviewer on scheduling
- Source tracking: job board · referral · agency · direct · other
- Rating and notes per applicant

### Offer Flow
- **Make Offer** — generates branded offer letter PDF from tenant template
- Offer letter stored in object storage, linked to applicant record
- Offer email auto-sent via Resend with PDF attachment
- **Token-protected offer response portal** — applicant accepts/declines online without login
- Accept / Decline tracked with timestamp

### Hire Flow
- **Mark as Hired** — auto-creates employee record + onboarding record pre-filled from applicant
- Redirects admin to new employee's onboarding record (`?open=` param)
- Auto-creates probation record using tenant's default probation weeks

### Pipeline Analytics
- Funnel chart: Applied → Screening → Interview → Offer → Hired (with cohort-based conversion rates)
- Average days per stage (from real transition timestamps)
- Average time-to-hire
- Monthly hires bar chart (last 12 months)
- Date range filters: 30 / 60 / 90 days / all time
- Source breakdown

### Bulk Import
- CSV upload with browser-side parsing and preview
- Row-level validation: required fields, email format
- Duplicate detection by email within tenant
- Import summary: imported · duplicates skipped · errors

---

## 4. Onboarding

### Employee Onboarding (`/onboarding`, `/admin/onboarding`)
- 10-step digital process: Personal Details · Contact Details · Emergency Contacts · Bank Details · Documents · Vetting & Compliance · Uniform · Terms & Conditions
- Status workflow: invited → in_progress → submitted → review → completed
- Admin view: manage all records, auto-open specific record via `?open=` query param
- Digital acceptance of terms and conditions

### Tenant Onboarding (`/tenant-onboarding`)
- Multi-step setup wizard for new tenants joining the platform

---

## 5. Supplier Management

### Suppliers (`/suppliers`)
- **95-column supplier record** — most comprehensive table in the system
- Company details, registered vs trading address, VAT status, bank details
- **Companies House integration:** company lookup, address history, director info, SIC codes, mortgages, filing dates
- **HMRC VAT API:** VAT number verification
- Supplier types: Ltd · sole trader · umbrella · PAYE · subcontractor
- Compliance fields: PAYE · RTW · NMW compliance flags
- Suspension workflow with reason, timestamp, user
- Info Required workflow: request missing info with notes
- **Pending changes:** supplier submits change → admin approve/reject
- Field request system: admin requests specific fields from supplier
- Portal access: enable/disable, send invitation, reset password
- Supplier code (unique reference), external ID, data visibility window (months)
- Self-billing agreement details embedded on supplier record
- Supplier audit trail, document audit, profile change log

### Supplier Portal (`/supplier-portal`)
- Separate authenticated login for suppliers
- Manage own profile, officers, documents, policies
- View timesheets derived from shifts — approve or dispute individual shifts
- Bulk approve / bulk dispute
- Accept or dispute invoices
- Self-billing agreement acceptance with digital signature + IP capture
- Submit onboarding details

### Supplier Audit Portal (`/supplier-audit-portal`)
- Read-only compliance audit view for third-party reviewers

### Supplier Documents
- Document upload per supplier (insurance, company reg, etc.)
- Document expiry monitoring — compliance alerts for expiring docs
- Audit trail per document

---

## 6. Self-Billing & Invoicing

### Self-Billing (`/self-billing`)
- HMRC VAT Notice 700/62 compliant
- Digital self-billing agreement per supplier (sign, IP capture, expiry date)
- Agreement renewal workflow
- Generate invoice for supplier + period: preview → confirm
- **Batch process entire month** for all suppliers at once with batch preview
- Invoice types: detailed · summary · with_remittance
- VAT-compliant PDF generation, period-aware supplier address
- Invoice numbering with full audit log (`invoice_number_audit_log`)

### Invoices (`/finance`)
- Manual and self-billed invoices
- Status: draft → issued → accepted → paid / disputed / cancelled
- Credit notes and debit notes (with line items)
- Record payment against invoice
- Batch PDF download
- Bulk delete (cascade-safe, preserves underlying shifts for re-invoicing)
- **Reverse Engineer Shifts** — reconcile bank payments by creating/adjusting/deleting shifts, with full rollback capability
- Invoice-level dispute management with message thread

### Client Invoices
- Separate invoicing module for client-side billing
- Client rate cards with charge rates
- Client invoice line items, PDF generation

### Remittance
- Remittance advice PDF for single invoices or a supplier's monthly invoices
- Maps bank transactions to payments
- Remittance Summary page (`/remittance-summary`) with period selector

---

## 7. Financial Management & Accounting

### Accounting (`/accounting`)
- Bank statement import and transaction management
- **Allocation dashboard:** match transactions to supplier or client invoices
- **AI Auto-Classification:** fuzzy matching + learned rules assigns vendors and allocates transactions automatically
- Auto-classification suggestions: accept · reject · batch-accept · batch-reject
- Manual allocation to supplier or client invoices
- General purchases: net/VAT split, expense category, vendor
- Purchase vendor management with transaction history
- Unclassified vendor detection and bulk classification
- Vendor classification rules (persistent learned patterns)
- Reconciliation view: allocated vs unallocated
- Suggested matches per transaction (AI-powered)
- Bank transaction and allocation export CSV
- Bank transaction batches

### VAT Return
- HMRC VAT return calculation from approved invoices
- VAT period summary with output/input tax breakdown
- VAT verification log

### Payroll (`/payroll`)
- Pending → Approved → Paid workflow for employee shifts
- Bulk approve / bulk reject with reasons
- Payroll runs: Draft → Finalised → Paid
- Variance tracking: Billed vs Paid hours and amounts
- KPI dashboard: pending total, approved total, paid total
- Payroll run items linked to individual shifts

### Finance Approval (`/finance-approval`)
- Finance status workflow on shifts: pending → approved → rejected
- Bulk finance approve/reject
- Finance note per shift

---

## 8. Compliance & Auditing

### Compliance (`/compliance`)
- Automated scan of employees and suppliers for expiring SIA · DBS · insurance · agreements · training
- Configurable alert thresholds per compliance type (7 / 14 / 30 days)
- Email alerts fired at threshold; deduplicated — one alert per record per threshold period
- Full compliance alert log
- Compliance settings per tenant (`/compliance-settings`)

### Pre-Audit Check (`/pre-audit-check`)
- Pre-audit verification for HMRC self-billing compliance
- Checks all invoices against shift data before submission
- Flags discrepancies, missing data, date mismatches

### Audit Trail
- Full audit log across all entities (`audit_logs` table)
- Employee-specific audit trail tab
- Download audit pack as ZIP per supplier (PDF + supporting docs)
- Audit trail PDF export per supplier

### Self-Billing Audit (`/self-billing-audit`)
- Full audit view of self-billing compliance per supplier
- Supplier HMRC Audit Portal — supplier-facing read-only audit view

---

## 9. AI Features

### AI Scheduling (`/ai-scheduling`)
- **GPT-4o powered** shift suggestion engine
- Inputs: site, date, requirements (e.g. "3 SIA Door Supervisor officers")
- Matches officers on: SIA licence validity · First Aid cert · proximity · past performance at site
- **Confidence scoring 0–100%** per suggestion
- Accept/reject decisions feed the self-learning engine (`ai_learning_events`)
- **Quick Fill:** emergency gap-filling — best available replacement instantly
- Live dashboard: Shifts Today · In Progress · Available Officers · No-Shows · Current Period
- Live alerts panel with one-click Quick Fill
- Learning Status Card: total decisions, accept/reject ratio, adaptive mode

### AI Controller Mode (Premium Add-on)

| Panel | Description |
|---|---|
| Situational Awareness | Real-time operational briefing, risk level (Low → Critical), coverage rate |
| Smart Alerts | Auto-triages issues (late arrivals, no-shows) with suggested actions |
| Quick Actions | Predict & Prevent, Auto-Reassign — one-click execution |
| AI Chat | Conversational assistant ("What's our current coverage?") |
| KPI Insights | AI-generated workforce efficiency and compliance bullet points |

### AI Email Command Centre (`/email-command-centre`)
- Integrates with **Microsoft 365 inbox** via Azure App Registration (Client ID, Secret, Tenant ID)
- Auto-polls connected inbox on configurable interval
- **AI Email Classifier (GPT-4o):** categorises emails as new_shift · cancellation · lateness · blowout · new_client · site_change · officer_replacement
- Proposes operational actions per email
- Operator approve/reject — rejection requires mandatory correction feedback
- Auto-approve toggle per action type
- Demo email generation for testing
- Unified AI learning engine (`ai_learning_events`) shared with scheduling domain
- Self-service connection from Settings tab
- Stored per-tenant in `tenant_email_connections`; auto-starts polling on server boot

### AI Auto-Contact System
- **Twilio** voice calls to officers who are late for check-in
- **ElevenLabs** AI-generated speech scripts dynamically produced per officer/shift
- Contact log and status tracking

### AI Auto-Classification (Accounting)
- Learns from past transaction allocations
- Fuzzy-matches vendor names to known suppliers
- Auto-proposes allocations for new transactions
- Classification rules persist as learned patterns

---

## 10. Communications

### Communications (`/communications`)
- Internal messaging channels
- Direct messages between users
- **Broadcasts** — announcements to all or filtered users with read-receipt tracking
- In-app notification system with real-time delivery
- **Web Push notifications** (VAPID keys) for employee portal
- Mobile push tokens for native app notifications

---

## 11. Employee Portal (Officer-Facing)

### Officer Home (`/officer/home`)
- Mobile-first dashboard with bottom tab navigation: Home · Shifts · ID Card · More
- Book On / Book Off quick actions with GPS validation
- **Pre-shift Ops Check dialog** — configurable checklist per tenant (`ops_check_items`)
- Book Off with handover notes capture
- **PWA (Progressive Web App)** — installable, app shell caching, offline capable
- Auto-redirect to Officer Home on login for employee-role users

### My Shifts (`/my-shifts`)
- View all assigned shifts
- GPS check-in and check-out (geofenced, distance shown)

### My Profile (`/my-profile`)
- Personal details editing
- Emergency contacts management
- Masked bank details with change request workflow
- Annual leave balance: days remaining · taken · entitlement · progress bar

### My Compliance (`/my-compliance`)
- SIA licence with days-remaining countdown
- DBS certificate status
- First Aid, Visa/BRP/Share Code — colour-coded expiry badges
- Training records: completions and expiry status

### My Documents (`/my-documents`)
- Document listing with expiry warnings
- Self-service document upload

### My Employment History (`/my-employment-history`)
- Previous employment timeline
- References and verification status

### Officer ID Card (`/officer/id`)
- Digital ID card with officer details and SIA licence info

### Additional Portal Pages
- **My Pay** (`/my-pay`) — payslip and earnings view
- **Time Off Request** (`/time-off-request`) — leave request submission
- **My Officers** (`/my-officers`) — supplier-side officer management
- **Incident Reporting** — officers can log incidents from the portal

---

## 12. Data Import & Sync

### Data Import (`/data-import`)
- CSV import for: employees · sites · clients · suppliers · timesheets
- Preview mode: parse and validate before committing
- Row-level error reporting with line numbers

### Data Sync (`/data-sync`)
- External REST/PHP API sync configurations per tenant
- API key, endpoint, field mappings
- Test connection · preview sync · run sync
- Incremental sync with `external_id` tracking
- Sync logs with per-run status, row counts, errors
- Cancel running sync
- Dependency-ordered sync (e.g. sites before shifts)
- `sanitizeDate()` handles invalid date values from legacy systems

---

## 13. Administration & Settings

### Settings (`/settings`)
- General tenant settings
- Leave entitlement defaults (days, carry-forward cap)
- Probation period default (weeks)
- Geofence radius and time window for check-in
- Email connection (Microsoft 365) — connect, test, disconnect, toggle polling, set interval
- **Document templates** — customise offer letters, invoices, timesheets, self-billing agreements
- **Ops Check items** — configure pre-shift checklists per tenant

### Role Management (`/role-management`)
- Granular permission matrix: 15 roles × all permission keys
- Edit permissions in-UI, persisted to `role_permissions` table

### Tenant Management (`/tenant-management`)
- Super admin: manage all tenants
- Create, view, configure tenants
- Add-on management per tenant

### Add-ons (`/addons`)
- Available add-ons listing
- Per-tenant activation (e.g. AI Controller Mode)
- Subscription plan management via Stripe

### Document Templates
- Template types: self-billing agreement · invoice (detailed/summary/with_remittance) · timesheet (with/without officer name) · offer letter
- Placeholder system: `{{APPLICANT_NAME}}` · `{{JOB_TITLE}}` · `{{SALARY}}` · `{{START_DATE}}` · `{{COMPANY_NAME}}`
- Default seeding on tenant creation
- PDF preview in-UI, set-as-default per type

### GDPR / Data Protection
- Consent records per employee (`data_consents`)
- Data erasure requests — admin review and action
- Erasure request log with status tracking (`/privacy-settings`)

---

## 14. Integrations

| Service | Purpose |
|---|---|
| **OpenAI (GPT-4o / GPT-4o-mini)** | AI scheduling, email classification, job description generation, controller mode, KPI insights |
| **Stripe** | Subscription plans, payment processing, webhook management |
| **Twilio** | SMS alerts, AI voice calls to late officers |
| **ElevenLabs** | AI speech synthesis for auto-contact calls |
| **Resend** | Transactional email (offer letters, compliance alerts, invitations) |
| **Companies House API** | Supplier company lookup, directors, SIC codes, filing history |
| **HMRC VAT API** | VAT number verification |
| **Microsoft Graph (Outlook)** | Email Command Centre inbox polling |
| **Replit Object Storage** | Document storage, offer letter PDFs, certificate uploads |
| **Web Push (VAPID)** | Browser push notifications for PWA |

---

## 15. Database Scale

| Metric | Value |
|---|---|
| Total tables | 103 |
| Composite indexes | 59+ |
| Largest table | `suppliers` — 95 columns |
| Shifts table | 53 columns |
| Invoices table | 98 columns (includes Stripe sync fields) |
| Employees table | 42 columns |

### Key Tables

| Table | Purpose |
|---|---|
| `shifts` | Core operational record — 53 columns covering scheduling, payroll, finance, GPS, supplier approval |
| `suppliers` | Supplier profile — 95 columns covering compliance, self-billing, Companies House data |
| `employees` | Employee record — 42 columns |
| `invoices` | Self-billed invoices — 98 columns inc. Stripe sync fields |
| `hr_cases` · `hr_case_events` · `hr_case_documents` | Disciplinary & grievance case management |
| `absence_records` | Absence and Bradford Factor tracking |
| `training_records` | Mandatory training and certification tracking |
| `probation_records` | New-starter probation periods |
| `leave_entitlements` | Annual leave balances per employee per year |
| `ai_learning_events` | Unified learning log for scheduling and email AI decisions |
| `bank_transactions` · `bank_transaction_allocations` | Financial reconciliation |
| `tenant_email_connections` | Microsoft 365 inbox connections per tenant |
| `sync_configurations` · `sync_logs` | External data sync management |
| `ops_check_items` · `ops_checks` | Configurable pre-shift checklists |
| `role_permissions` | Granular RBAC per tenant |

---

## 16. Pages Index

| Route | Page |
|---|---|
| `/` | Landing / Login |
| `/dashboard` | Main Dashboard |
| `/hr-dashboard` | HR Overview Dashboard |
| `/scheduling` | Shift Scheduling |
| `/control-room` | Live Control Room |
| `/deployment-map` | UK Deployment Map |
| `/sites` | Site Management |
| `/employees` | Employee Management |
| `/hr-cases` | Disciplinary & Grievance |
| `/probation` | Probation Tracking |
| `/admin/absences` | Absence Management |
| `/training-matrix` | Training Records Matrix |
| `/leave-requests` | Leave Request Management |
| `/vetting` | Vetting Records |
| `/recruitment` | Recruitment Pipeline |
| `/onboarding` | Employee Onboarding (self-service) |
| `/admin/onboarding` | Onboarding Admin View |
| `/suppliers` | Supplier Management |
| `/supplier-portal` | Supplier Self-Service Portal |
| `/supplier-audit-portal` | Supplier Audit Portal |
| `/supplier-timesheets` | Supplier Timesheets |
| `/admin-supplier-timesheets` | Admin Supplier Timesheets |
| `/self-billing` | Self-Billing Invoice Generation |
| `/self-billing-audit` | Self-Billing Audit |
| `/finance` | Invoice Management |
| `/finance-approval` | Finance Approval Workflow |
| `/accounting` | Bank & Accounting |
| `/payroll` | Payroll Management |
| `/remittance-summary` | Remittance Summary |
| `/financial-documents` | Financial Document Store |
| `/compliance` | Compliance Monitoring |
| `/compliance-settings` | Compliance Alert Settings |
| `/pre-audit-check` | Pre-Audit Compliance Check |
| `/audit-trail` | Full Audit Trail |
| `/ai-scheduling` | AI Smart Scheduler |
| `/ai-analytics` | AI Analytics & Predictions |
| `/email-command-centre` | AI Email Command Centre |
| `/communications` | Internal Messaging |
| `/data-import` | CSV Data Import |
| `/data-sync` | External API Data Sync |
| `/reports` | Reports & Exports |
| `/settings` | Tenant Settings |
| `/role-management` | Role & Permission Management |
| `/tenant-management` | Tenant Administration |
| `/addons` | Add-on Management |
| `/company-profile` | Company Profile |
| `/privacy-settings` | GDPR / Privacy Settings |
| `/officer/home` | Officer Home (PWA) |
| `/my-shifts` | My Shifts (Officer Portal) |
| `/my-profile` | My Profile (Officer Portal) |
| `/my-compliance` | My Compliance (Officer Portal) |
| `/my-documents` | My Documents (Officer Portal) |
| `/my-employment-history` | My Employment History |
| `/officer/id` | Digital Officer ID Card |
| `/my-pay` | My Pay / Payslips |
| `/time-off-request` | Time Off Request (Officer) |
| `/offer-response/:token` | Applicant Offer Response Portal |

---

*Generated: May 2026 — Gardeo v1.0*
