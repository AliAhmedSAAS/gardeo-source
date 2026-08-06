# Gardeo - Enterprise Workforce Management Platform

## Overview
Gardeo is a multi-tenant workforce management platform designed to streamline and automate complex workforce operations for security officers, with adaptability for cleaning, maintenance, and engineering industries.

Key capabilities include:
- AI-powered scheduling and live control room for real-time monitoring.
- Comprehensive UK deployment map and automated vetting processes.
- HMRC VAT compliant self-billing and payroll management.
- Intuitive employee portal with mobile-first Officer Home dashboard and PWA support.
- Pre-shift Ops Check system with tenant-configurable checklists.
- Recruitment module.
- Advanced data import, migration, and external data synchronization tools with `external_id` support.
- Financial management with bank statement processing, payment allocation, general purchase categorization, and HMRC VAT return calculation.
- Premium add-ons like AI Controller Mode for enhanced situational awareness and smart alerts.

Gardeo aims to revolutionize workforce management by providing a centralized, intelligent, and compliant solution that enhances operational efficiency and reduces administrative overhead across various service industries.

## User Preferences
- Custom authentication required (NOT Replit Auth)
- Professional color scheme: Navy Blue (#1F3A5F) primary, Orange (#FF8C42) accent
- Inter font family
- Frontend development prioritized
- UK-focused (postcodes, HMRC, SIA, DBS)

## System Architecture
The Gardeo platform is built on a modern full-stack architecture designed for scalability, performance, and maintainability.

**Frontend:**
- Developed with React and TypeScript.
- Uses Wouter for routing, Shadcn UI and Tailwind CSS for styling.
- Data fetching and state management via TanStack Query.
- Adheres to a professional aesthetic with Navy Blue and Orange color scheme and Inter font.

**Backend:**
- Built with Express.js.
- Authentication managed by Passport.js (`passport-local`) and `express-session` (persisted in PostgreSQL) for web dashboard.
- JWT token-based authentication (`jsonwebtoken`) for mobile app access via `server/jwt-auth.ts`. Mobile endpoints: `POST /api/auth/mobile/login`, `POST /api/auth/mobile/refresh`, `GET /api/auth/mobile/user`. Access tokens expire in 15 minutes; refresh tokens in 30 days. The `requireAuth` and `requireRole` middleware transparently accept both session cookies and JWT Bearer tokens.
- CORS configured via the `cors` package to allow any origin with credentials for mobile/cross-origin API access.
- Implements a comprehensive Role-Based Access Control (RBAC) system with 15 distinct roles.
- Features unique, tenant-scoped display IDs for all entities (e.g., EMP-00001).
- **Supplier Rate Cards:** Supports general, site-specific, employee-specific, or combined rates with a priority-based lookup system. Includes a "Per-Shift Rate" mode for invoice generation based on individual shift rates.
- **Financial Features:** Includes Client Management with charge rate cards, Payroll Management (Pending → Approved → Paid workflow), automated vetting, audit trails, and document template management.
- **Reverse Engineer Shifts (Invoice-Aware):** System to reconcile bank payments against invoices by creating, adjusting, or deleting shifts and invoices, with full rollback capabilities.
- **Remittance Advice:** Generates PDF remittance advice for single invoices or a supplier's monthly invoices, mapping bank transactions to payments. A dedicated "Remittance Summary" page and PDF report provide detailed payment allocations for a selected period.
- **Invoice Deletion:** Safe cascade deletion of invoices, credit notes, debit notes, and bank allocations, ensuring underlying shifts are preserved for re-invoicing.
- **Performance Optimizations:** Server-side SQL pagination with LIMIT/OFFSET is used for high-volume data displays like Sites, Admin Supplier Timesheets, and Employees (3,700+ records). The `/api/admin/employees` endpoint supports both paginated mode (when `page` query param is present, returns `{data, total, totalPages, stats}`) and backward-compatible array mode (no `page` param, returns full array) for existing consumers.
- **Document Templates:** Customizable templates for self-billing agreements, invoices (detailed, summary, with_remittance formats), and timesheets (with/without officer name), with default seeding and PDF preview.
- **Invoice PDF Changes:** Enhanced invoice PDFs to be HMRC compliant, remove specific notices, and include clear remittance and period-aware supplier address details.
- **AI Integration:** Utilizes OpenAI for AI-powered scheduling and premium AI Controller Mode features (Situational Awareness, Smart Alerts, Quick Actions, AI Chat, KPI Insights).
- **AI Email Command Centre:** AI-powered email triage system that classifies incoming control room emails (new shift, cancellation, lateness, blowout, new client, site change, officer replacement), proposes operational actions, supports operator approve/reject with mandatory correction feedback on rejection. Features auto-approve toggle per action type and a unified AI learning engine (`ai_learning_events` table) shared across email and scheduling domains. Route: `/email-command-centre`. Demo email generation available for testing. Backend services: `server/email-classifier.ts`, `server/email-action-executor.ts`, `server/email-command-service.ts`. **Self-service email connection:** Tenants can connect their Microsoft 365 inbox directly from Settings tab — enter Azure App Registration credentials (Client ID, Client Secret, Azure Tenant ID), test connection, and start auto-polling. Stored per-tenant in `tenant_email_connections` table. Supports connect/disconnect/test/polling toggle/interval config. Auto-initializes polling for connected tenants on server startup.
- **Automated Compliance Alerts:** Scans employees and suppliers for expiring compliances (SIA, DBS, insurance, agreements) within set thresholds, sends email alerts, and logs activity.
- **Control Room Enhancements:** Includes a Shift Status Timeline, Site Coverage Dashboard, Shift Handover Notes, Auto-Escalation Rules, Enhanced Incident Workflow with visual progress, and a Controller Activity Log.
- **Geolocation Check-in/Check-out:** GPS-validated shift check-in and check-out with Haversine distance calculation, configurable geofence radius and time window (tenant settings), distance display in admin shift details and employee portal, and historical data backfill endpoint.
- **Officer Mobile Portal (PWA):** Installable PWA with app shell caching, mobile bottom tab navigation (Home/Shifts/ID Card/More) for employee-role users, Officer Home dashboard with Book On/Off quick actions, pre-shift Ops Check dialog with configurable checklists per tenant, Book Off with handover notes capture. Employee users are auto-redirected to the Officer Home on login. Self-service portal includes: My Profile (personal details, gender, nationality, NI number, address, emergency contacts, masked bank details with change request workflow), My Documents (document listing with expiry warnings and upload), My Compliance (SIA licence with countdown, DBS certificate, first aid, visa/BRP/share code with color-coded expiry badges: green >90d, amber 30-90d, red <30d), My Employment History (previous employment timeline with references and verification status).
- **Schema additions:** `ops_check_items` (tenant-configurable checklist items), `ops_checks` (per-shift check records), `handoverNotes` field on shifts.
- **Employee Data Mirror Sync:** Full field parity with external PHP system. `employee_immigration` table stores structured passport, visa, BRP, and share code data (one row per employee). Employees table has `place_of_birth`. Employment history has `verification_status`, `submitted_date`, `referee_address`, `referee_postcode`. References has `verification_status`. Documents has `external_uploaded_at`. Sync logic uses full overwrite (not COALESCE fill-blanks). Employee detail UI includes Immigration tab, place of birth, last synced indicator, and external upload dates on documents.
- **FM Services Add-on:** Per-tenant addon (`fm_services`, free activation, no Stripe) that unlocks parallel facilities-management workforce features (cleaning, maintenance, engineering) sharing existing Sites but with their own workers, suppliers, jobs (reactive/PPM/project), assignments, and PPM schedules. New tables: `fm_workers`, `fm_suppliers`, `fm_jobs`, `fm_job_assignments`, `fm_ppm_schedules`. Routes under `/api/fm/*` gated by `requireRole(...ops roles)` + `requireFmAddon` middleware, with `assertTenantOwns` helper validating all foreign IDs (siteId, supplierId, workerId, ppmScheduleId) against tenant before insert/update, and tenant predicates on every join. Frontend pages: `/fm-dashboard`, `/fm-workers`, `/fm-jobs`, `/fm-suppliers`, `/fm-ppm`, `/fm-settings`. Sidebar shows an "FM Services" group only when the addon is active (queried via `/api/addons/check/fm_services`). Activation handled from the Add-ons page via a free-activation button.
- **Employee Deduplication & Merge:** Admin-only tool accessible from Employees page via "Find Duplicates" button. Detects duplicate employee groups by matching on name, SIA licence, and NI number. Shows side-by-side comparison with confidence scoring. Admins select a primary record and merge secondaries (all shifts, documents, bank details, etc. get reassigned). Merged records are soft-deleted (`is_merged`, `merged_into_id`, `merged_at` columns). Orphaned placeholder records (no external_id, placeholder email, zero shifts) can be bulk-purged. All operations logged to `audit_logs`. Routes: `GET /api/admin/employees/duplicates`, `POST /api/admin/employees/merge`, `POST /api/admin/employees/bulk-purge`.

**Database:**
- PostgreSQL is the primary data store, managed via Drizzle ORM.
- Comprehensive schema with 18+ tables.
- Extensive use of composite indexes (59 defined) for performance, especially for tenant isolation and filtered listings.
- **Tenant-scoped uniqueness:** The `users` table uses composite unique indexes `(tenant_id, email)` and `(tenant_id, username)` instead of global uniqueness, allowing the same person to work across multiple tenants with separate profiles. Login supports multi-tenant selection when an email matches multiple tenants.

**AI Integration:**
- OpenAI is integrated via Replit AI Integrations (`AI_INTEGRATIONS_OPENAI_API_KEY`).

**Security:**
- Session management uses `SESSION_SECRET` with secure cookies in production.
- Consistent password validation.
- Tenant isolation enforced across the platform.

**Design Principles:**
- Modularity, reusability, clear separation of concerns.
- User-centric design with intuitive workflows.
- Strong commitment to compliance (HMRC VAT, BS7858, GDPR) and data integrity.

## External Dependencies
- **OpenAI:** For AI-powered scheduling and AI Controller Mode.
- **Stripe:** For subscription management and payment processing.
- **Twilio:** For AI Auto-Contact System (SMS/voice calls).
- **ElevenLabs:** For AI speech capabilities.
- **Companies House API:** For company lookups, address history, and director information.
- **PostgreSQL:** Primary database.
- **Object Storage:** For document management.