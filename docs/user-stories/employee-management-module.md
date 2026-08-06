# Employee Management Module - Detailed User Stories

## Module Overview

The Employee Management module is the central hub for managing the entire workforce lifecycle within Gardeo. It provides HR managers, admins, and operational staff with tools to add employees, track compliance with BS7858 security screening standards, manage company policies and handbooks, maintain a complete audit trail of every employee action, manage vetting records, documents, and emergency contacts — all within a multi-tenant, role-secured environment.

---

## Epic 1: Employee Directory & Search

### US-1.1: View Employee Directory
**As an** HR Manager / Tenant Admin  
**I want to** see a complete list of all employees in my organisation  
**So that** I can quickly access any employee's information and manage my workforce effectively.

**Acceptance Criteria:**
- Dashboard displays 4 summary statistic cards at the top:
  - **Total Employees** — count of all employee records in the tenant
  - **Active** — count of employees with active user accounts (green)
  - **Fully Compliant** — count of employees who have passed all assigned vetting checks
  - **Onboarding** — count of employees currently going through the onboarding process
- Each employee is displayed as a card showing:
  - Avatar with initials (first letter of first name + first letter of last name)
  - Full name
  - Email address
  - Job title or role
  - Onboarding status badge (Invited / In Progress / Submitted / Under Review / Approved / Rejected / Completed)
  - Compliance status badge (Compliant / Partial / Non-Compliant / No Checks)
  - Inactive badge if account is deactivated
- Loading state shows skeleton cards while data is fetching
- Empty state with helpful message when no employees exist

**Roles with Access:**  
Super Admin, Tenant Admin, CEO, Operations Manager, Regional Manager, Admin, HR Manager, Controller, Scheduler, Compliance Manager, Training Manager, Payroll Manager

---

### US-1.2: Search & Filter Employees
**As an** HR Manager  
**I want to** search employees by name, email, role, or job title and filter by status  
**So that** I can quickly find specific employees or view subsets of the workforce.

**Acceptance Criteria:**
- Search input field with magnifying glass icon
- Search matches against: full name, email, role, and job title (case-insensitive)
- Filter buttons available:
  - **All** — show all employees
  - **Active** — employees with active user accounts only
  - **Inactive** — employees with deactivated accounts only
  - **Compliant** — employees who have passed all vetting checks
  - **Non-Compliant** — employees with at least one vetting check but not all passed
- Active filter button is visually distinguished (filled vs outline)
- Search and filter work together (combined filtering)
- Results update instantly as user types or changes filter

---

## Epic 2: Add New Employee

### US-2.1: Create Employee Record
**As an** HR Manager / Tenant Admin  
**I want to** add a new employee to the system with their personal and employment details  
**So that** I can begin their onboarding journey and set up their profile.

**Acceptance Criteria:**
- "Add Employee" button prominently displayed at top right of page (Navy Blue styled)
- Clicking opens a modal dialog titled "Add New Employee"
- Information banner explains default password: "Password123!"
- Form is divided into 3 sections:

  **Personal Information (Required & Optional):**
  | Field | Type | Required | Validation |
  |-------|------|----------|------------|
  | First Name | Text | Yes | Non-empty |
  | Last Name | Text | Yes | Non-empty |
  | Email | Email | Yes | Valid email format |
  | Username | Text | Yes | Unique across system |
  | Phone | Text | No | UK format (07xxx) |
  | Date of Birth | Date picker | No | — |

  **Employment Details:**
  | Field | Type | Required | Validation |
  |-------|------|----------|------------|
  | Job Title | Text | No | e.g. "Security Officer" |
  | Department | Text | No | — |
  | Employment Type | Dropdown | No | Full Time / Part Time / Contract / Zero Hours (default: Full Time) |
  | Start Date | Date picker | No | — |
  | NI Number | Text | No | UK NI format (QQ 12 34 56 C) |
  | Gender | Dropdown | No | Male / Female / Other / Prefer not to say |

  **Address:**
  | Field | Type | Required |
  |-------|------|----------|
  | Address Line 1 | Text (full width) | No |
  | City | Text | No |
  | County | Text | No |
  | Postcode | Text | No |
  | Nationality | Text | No (default: British) |

- Submit button disabled until all required fields (First Name, Last Name, Email, Username) are filled
- On submission:
  1. A user account is created with the "employee" role and default password
  2. An employee record is linked to the user account
  3. An audit trail entry "Employee Record Created" is automatically logged
  4. Success toast confirms creation with reminder of default password
  5. Employee list refreshes to include the new employee
  6. Form resets to empty state
- Duplicate username returns an error toast
- Cancel button closes the dialog without saving

**Roles with Access:**  
Super Admin, Tenant Admin, CEO, Operations Manager, Admin, HR Manager

---

## Epic 3: Employee Profile & Detail View

### US-3.1: View Employee Profile
**As an** HR Manager  
**I want to** click on any employee card to view their complete profile  
**So that** I can see all their information, compliance status, and history in one place.

**Acceptance Criteria:**
- Clicking any employee card opens a full-width modal dialog (max 3xl width)
- Header shows:
  - Large avatar with initials
  - Full name (bold title)
  - Email and phone number
  - Job title / role and employee number
- 7 tabbed sections accessible via tab bar:
  1. **Personal** (default active tab)
  2. **BS7858**
  3. **Vetting**
  4. **Documents**
  5. **Policies**
  6. **Audit Trail**
  7. **Emergency**
- Dialog scrollable if content exceeds viewport (max 85vh)
- Loading spinner shown while employee detail data is fetching
- Closing dialog clears the selected employee

---

### US-3.2: Personal Information Tab
**As an** HR Manager  
**I want to** view all personal and employment details for an employee  
**So that** I have quick access to their core information.

**Acceptance Criteria:**
- Displays information in a structured 2-column grid:
  - Employee Number, Job Title, Department, Employment Type
  - Start Date, Date of Birth, Gender, Nationality, NI Number
- Address section with map pin icon showing full formatted address
- SIA License & DBS section showing:
  - SIA License Number, SIA Type, SIA Expiry Date
  - DBS Certificate Number, DBS Issue Date
  - First Aid status with expiry date
- "N/A" displayed for any empty fields
- Dates formatted in UK format (e.g. "15 Jan 2025")

---

## Epic 4: BS7858 Security Screening Compliance

### US-4.1: View BS7858 Compliance Checklist
**As an** HR Manager / Compliance Manager  
**I want to** see the BS7858 security screening compliance status for each employee  
**So that** I can ensure all employees meet British Standard requirements for security industry vetting.

**Acceptance Criteria:**
- BS7858 tab shows the official compliance checklist header with description: "British Standard for security screening of individuals employed in a security environment"
- Overall compliance summary displayed in top-right corner:
  - Large percentage score (colour-coded: green = compliant, orange = partial, red = non-compliant)
  - Badge showing "X/Y Passed" fraction
- 9-point checklist items displayed as individual cards:

  | # | Check | Description | How Status is Determined |
  |---|-------|-------------|------------------------|
  | 1 | Identity Verification | Confirm identity with valid photo ID | Vetting record type "identity" with "passed" status |
  | 2 | Right to Work | Verify UK right to work documentation | Vetting record type "right_to_work" with "passed" status |
  | 3 | DBS Check | Disclosure and Barring Service check | Vetting record type "dbs" with "passed" status OR DBS certificate number on file |
  | 4 | Employment History | 5+ years verified employment history | Employment history records exist for the employee |
  | 5 | References | Professional references verified | Reference records exist for the employee |
  | 6 | Address Verification | Proof of current address | Vetting record type "address" with "passed" status OR address fields populated |
  | 7 | Credit Check | Financial background check | Vetting record type "credit" with "passed" status |
  | 8 | SIA License | Security Industry Authority license valid | Vetting record type "sia" with "passed" status OR SIA license number on file |
  | 9 | Qualifications | Relevant qualifications verified | Vetting record type "qualifications" with "passed" status |

- Each check displays:
  - Status icon: green checkmark (Passed), orange clock (Pending), red X (Not Started), yellow triangle (Expired)
  - Check name and description
  - Status badge: "Passed" / "Pending" / "Not Started" / "Expired"
  - Additional details when available (e.g. reference number, completion date, expiry date)
- Compliance data is dynamically calculated from actual employee records (vetting, documents, employment history, references)

**Roles with Access:**  
Super Admin, Tenant Admin, CEO, Operations Manager, Admin, HR Manager, Compliance Manager

---

## Epic 5: Vetting Records Management

### US-5.1: View Employee Vetting Records
**As an** HR Manager  
**I want to** see all vetting checks conducted on an employee  
**So that** I can monitor their screening progress and compliance.

**Acceptance Criteria:**
- Vetting tab shows all vetting records for the selected employee
- Each vetting record displays as a card with:
  - Check type name (e.g. "DBS Check", "SIA License")
  - Reference number (if available)
  - Status badge with colour coding:
    - **Not Started** — grey/secondary
    - **Pending** — grey/secondary
    - **In Progress** — grey/secondary
    - **Passed** — green/default
    - **Failed** — red/destructive
    - **Expired** — red/destructive
  - Three date columns: Requested date, Completed date, Expiry date
  - Notes section (if any notes attached)
- Empty state message when no vetting records exist
- Vetting records are created and managed via the Vetting module (/vetting), which automatically creates audit trail entries when checks are initiated or status changes

---

## Epic 6: Document Management

### US-6.1: View Employee Documents
**As an** HR Manager  
**I want to** view all documents uploaded for an employee  
**So that** I can track their documentation status for compliance purposes.

**Acceptance Criteria:**
- Documents tab shows all documents linked to the employee
- Each document displayed as a card with:
  - File icon and file name
  - Document type and upload date
  - Expiry date (if applicable)
  - Verification badge: "Verified" (green) or "Pending" (grey)
- Empty state with file icon when no documents exist
- Document uploads trigger an automatic audit trail entry: "Document Uploaded: [type]"

---

## Epic 7: Policy & Handbook Management

### US-7.1: View Employee Policies
**As an** HR Manager / Compliance Manager  
**I want to** see all policies and handbooks issued to an employee  
**So that** I can ensure they have received and acknowledged all required company policies.

**Acceptance Criteria:**
- Policies tab shows a list of all issued policies with:
  - Policy type icon (book for handbook, scroll for policy)
  - Policy name
  - Version number (default "1.0")
  - Issue date and time
  - Acknowledgment date and time (if acknowledged, shown in green)
  - Notes (if any)
  - Status badge: "Acknowledged" (green) or "Pending" (grey)
  - "Acknowledge" button for pending policies
- Empty state with helpful guidance: "Click 'Issue Policy' to assign policies and handbooks"
- Acknowledging a policy:
  - Records the current user and timestamp
  - Updates badge from "Pending" to "Acknowledged"
  - Creates an audit trail entry: "Policy Acknowledged: [policy name]"

---

### US-7.2: Issue Policy to Employee
**As an** HR Manager / Training Manager  
**I want to** issue a company policy or handbook to an employee  
**So that** I have a formal record that the employee has been given the policy for review and acknowledgment.

**Acceptance Criteria:**
- "Issue Policy" button at top of Policies tab (Navy Blue styled)
- Opens a dialog titled "Issue Policy / Handbook"
- Form fields:
  | Field | Type | Required | Details |
  |-------|------|----------|---------|
  | Policy Name | Dropdown | Yes | 16 predefined options (see list below) |
  | Version | Text | No | Default "1.0" |
  | Notes | Textarea | No | Additional instructions or notes |

- **16 Standard Policies Available:**
  1. Company Handbook
  2. Health & Safety Policy
  3. Data Protection Policy (GDPR)
  4. Equal Opportunities Policy
  5. Disciplinary Procedure
  6. Grievance Procedure
  7. Anti-Bribery & Corruption Policy
  8. Whistleblowing Policy
  9. Uniform & Appearance Policy
  10. Lone Worker Policy
  11. Use of Force Policy
  12. Mobile Phone & Device Policy
  13. Social Media Policy
  14. Drug & Alcohol Policy
  15. Absence Management Policy
  16. Code of Conduct

- On submission:
  1. Policy record created with "pending" status
  2. Audit trail entry logged: "Policy Issued: [policy name]"
  3. Success toast confirmation
  4. Employee detail data refreshes
  5. Dialog closes and form resets

**Roles with Access:**  
Super Admin, Tenant Admin, CEO, Operations Manager, Admin, HR Manager, Compliance Manager, Training Manager

---

## Epic 8: Employee Lifecycle Audit Trail

### US-8.1: View Employee Audit Trail
**As an** HR Manager / Compliance Manager  
**I want to** see a complete timeline of all events in an employee's lifecycle  
**So that** I have a full audit trail for compliance, investigations, and governance purposes.

**Acceptance Criteria:**
- Audit Trail tab displays a vertical timeline with a connecting line
- Each event shows:
  - Colour-coded circular icon based on event type:
    - Employee Created → green user-check icon
    - Screening Letter Sent → blue mail icon
    - Document Uploaded → indigo file icon
    - Document Verified → green file-check icon
    - Vetting Requested → orange shield-check icon
    - Vetting Completed → green shield icon
    - Policy Issued → purple book icon
    - Policy Acknowledged → green checkmark icon
    - Reference Received → blue scroll icon
    - DBS Completed → green shield icon
    - Other → grey circle dot icon
  - Event title (bold)
  - Category badge with colour coding:
    - Onboarding → blue
    - Compliance → purple
    - Vetting → orange
    - Documents → indigo
    - General → grey
  - Description text (if available)
  - Timestamp in UK format with time (e.g. "15 Jan 2025, 14:30")
  - Performer name (e.g. "by John Smith")
- Events sorted chronologically (newest first)
- Empty state when no events exist

**Automatic Events (system-generated):**
- Employee record creation
- Document uploads
- Vetting check requests
- Vetting status changes (passed/failed/expired)
- Policy issuance
- Policy acknowledgment

---

### US-8.2: Manually Log Audit Event
**As an** HR Manager  
**I want to** manually log a significant event in an employee's audit trail  
**So that** I can record important milestones or actions that aren't automatically captured by the system.

**Acceptance Criteria:**
- "Log Event" button (outline style) at top of Audit Trail tab
- Opens dialog with form fields:
  | Field | Type | Required | Details |
  |-------|------|----------|---------|
  | Event Type | Dropdown | Yes | Predefined event types (see below) |
  | Category | Dropdown | No | general / onboarding / compliance / vetting / documents (default: general) |
  | Title | Text | Yes | Short description of the event |
  | Description | Textarea | No | Detailed notes |

- **Available Event Types:**
  - Employee Created
  - Screening Letter Sent
  - Document Uploaded
  - Document Verified
  - Vetting Requested
  - Vetting Completed
  - Policy Issued
  - Policy Acknowledged
  - Reference Received
  - DBS Completed

- On submission:
  1. Event recorded with current timestamp and performer details
  2. Audit trail refreshes to show new event
  3. Success toast: "Event logged"
  4. Dialog closes and form resets

**Roles with Access:**  
Super Admin, Tenant Admin, CEO, Operations Manager, Admin, HR Manager, Compliance Manager

---

## Epic 9: Emergency Contacts

### US-9.1: View Emergency Contacts
**As an** HR Manager / Operations Manager  
**I want to** see emergency contacts for each employee  
**So that** I can reach the right person in case of an emergency during a shift.

**Acceptance Criteria:**
- Emergency tab displays all contacts as individual cards
- Each contact card shows:
  - Contact name
  - Relationship to employee
  - "Primary" badge if designated as primary contact
  - Phone number with phone icon
  - Alternate phone (if available)
  - Email address (if available)
- Empty state message when no emergency contacts exist

---

## Non-Functional Requirements

### NFR-1: Role-Based Access Control (RBAC)
- All employee management endpoints are protected by role-based middleware
- 12 of 15 system roles have read access to the employee directory
- Write operations (add employee, issue policy, log audit event) restricted to admin roles
- All data is tenant-scoped — users can only see employees within their own organisation
- Super Admin can access all tenants

### NFR-2: Data Integrity & Compliance
- All employee data is stored in PostgreSQL with proper relational integrity
- BS7858 compliance is dynamically calculated from real data (not manually set)
- Audit trail entries are immutable once created
- All dates displayed in UK format (dd MMM yyyy)
- NI Numbers follow UK format conventions

### NFR-3: Performance
- Employee list loads with skeleton state during fetch
- Employee detail data loaded on-demand (only when profile opened)
- BS7858 data fetched separately to avoid slowing the detail view
- Query cache invalidated after any mutation to ensure fresh data

### NFR-4: Accessibility
- All interactive elements have data-testid attributes for automated testing
- Buttons include clear labels and icon indicators
- Colour-coded status badges use distinct variants (not colour alone) for accessibility
- Dialog modals are scrollable and responsive

---

## Data Model

### Employee Profile Fields
| Field Group | Fields |
|-------------|--------|
| Personal | Employee Number, First Name, Last Name, Email, Phone, Date of Birth, Gender, Nationality, NI Number |
| Address | Address Line 1, Address Line 2, City, County, Postcode, Country |
| Employment | Job Title, Department, Employment Type, Start Date, Hourly Rate |
| Equipment | Uniform Size, Boot Size, Equipment Notes |
| Licensing | SIA License Number, SIA License Type, SIA Expiry Date |
| DBS | DBS Certificate Number, DBS Issue Date |
| First Aid | Has First Aid (boolean), First Aid Expiry |

### Related Data
| Entity | Relationship | Key Fields |
|--------|-------------|------------|
| Vetting Records | One-to-many | Check Type, Status, Reference Number, Dates, Result, Notes |
| Documents | One-to-many | Document Type, File Name, File URL, File Size, Expiry, Verified |
| Emergency Contacts | One-to-many | Name, Relationship, Phone, Alt Phone, Email, Is Primary |
| References | One-to-many | Referrer details, relationship, verification status |
| Employment History | One-to-many | Employer, role, dates, reason for leaving |
| Policies | One-to-many | Policy Name, Type, Version, Issued/Acknowledged dates, Status |
| Audit Trail | One-to-many | Event Type, Category, Title, Description, Performer, Timestamp |

---

## API Endpoints

| Method | Endpoint | Purpose | Roles |
|--------|----------|---------|-------|
| GET | /api/admin/employees | List all employees (tenant-scoped) | 12 admin roles |
| GET | /api/admin/employees/:id | Get employee detail with vetting, documents, contacts, policies, audit trail | 12 admin roles |
| POST | /api/admin/employees | Create new employee + user account | 6 senior admin roles |
| GET | /api/admin/employees/:id/bs7858 | Get BS7858 compliance checklist | 7 compliance-related roles |
| GET | /api/admin/employees/:id/policies | List issued policies | 8 admin roles |
| POST | /api/admin/employees/:id/policies | Issue a policy to employee | 8 admin roles |
| PATCH | /api/admin/employees/:id/policies/:policyId/acknowledge | Acknowledge a policy | Any authenticated user |
| GET | /api/admin/employees/:id/audit-trail | View audit trail timeline | 7 compliance-related roles |
| POST | /api/admin/employees/:id/audit-trail | Manually log an audit event | 7 compliance-related roles |

---

## Test Scenarios

### Happy Path
1. HR Manager logs in → navigates to Employee Management → sees dashboard with stats
2. Searches for "John" → filters to Active only → finds employee
3. Clicks "Add Employee" → fills required fields → submits → sees new employee in list
4. Clicks new employee → views Personal tab → switches to BS7858 → sees compliance %
5. Switches to Policies → issues "Company Handbook" → sees it listed as Pending
6. Clicks Acknowledge on the policy → status changes to Acknowledged
7. Switches to Audit Trail → sees timeline with Created, Policy Issued, and Policy Acknowledged events
8. Clicks "Log Event" → records "Screening Letter Sent" → sees it in timeline

### Edge Cases
- Adding employee with duplicate username → error toast, form stays open
- Viewing employee with no vetting records → BS7858 shows 0% with all "Not Started"
- Viewing employee with no documents/contacts/policies → appropriate empty states shown
- Search with no results → "No employees found" with filter adjustment suggestion
- Very long employee list → cards render efficiently with scroll
