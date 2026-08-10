import { sql } from "drizzle-orm";
import {
  pgTable, text, varchar, serial, integer, boolean, timestamp,
  jsonb, index, uniqueIndex, date, pgEnum, numeric
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const userRoleEnum = pgEnum("user_role", [
  "super_admin", "tenant_admin", "ceo", "operations_manager",
  "regional_manager", "admin", "controller", "scheduler",
  "hr_manager", "compliance_manager", "accountant", "payroll_manager",
  "training_manager", "supplier", "employee"
]);

export const onboardingStatusEnum = pgEnum("onboarding_status", [
  "invited", "in_progress", "submitted", "under_review",
  "approved", "rejected", "completed"
]);

export const vettingStatusEnum = pgEnum("vetting_status", [
  "not_started", "pending", "in_progress", "passed", "failed", "expired"
]);

export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)]
);

export const tenants = pgTable("tenants", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  tradingName: text("trading_name"),
  slug: text("slug").notNull().unique(),
  industry: text("industry").default("security"),
  address: text("address"),
  addressLine1: text("address_line_1"),
  addressLine2: text("address_line_2"),
  city: text("city"),
  county: text("county"),
  postcode: text("postcode"),
  phone: text("phone"),
  email: text("email"),
  website: text("website"),
  vatNumber: text("vat_number"),
  companyRegNumber: text("company_reg_number"),
  companyStatus: text("company_status"),
  siaAcsNumber: text("sia_acs_number"),
  logoUrl: text("logo_url"),
  subdomain: text("subdomain").unique(),
  planId: integer("plan_id"),
  trialEndsAt: timestamp("trial_ends_at"),
  onboardingCompleted: boolean("onboarding_completed").default(false),
  isActive: boolean("is_active").default(true),
  selfBillingSignatoryName: text("self_billing_signatory_name"),
  selfBillingSignatoryPosition: text("self_billing_signatory_position"),
  selfBillingSignatureData: text("self_billing_signature_data"),
  selfBillingSignatureDate: timestamp("self_billing_signature_date"),
  hrSignatoryName: text("hr_signatory_name"),
  hrSignatoryPosition: text("hr_signatory_position"),
  hrSignatureData: text("hr_signature_data"),
  hrSignatureDate: timestamp("hr_signature_date"),
  vatCalculationType: text("vat_calculation_type").default("accrual"),
  checkinTimeWindowMinutes: integer("checkin_time_window_minutes").default(10),
  geofenceRadiusMetres: integer("geofence_radius_metres").default(200),
  onboardingDeadlineDays: integer("onboarding_deadline_days").default(7),
  supplierDataVisibilityMonths: integer("supplier_data_visibility_months"),
  defaultLeaveEntitlementDays: integer("default_leave_entitlement_days").default(28),
  leaveCarryForwardCapDays: integer("leave_carry_forward_cap_days").default(5),
  defaultProbationWeeks: integer("default_probation_weeks").default(12),
  createdAt: timestamp("created_at").defaultNow(),
});

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: integer("tenant_id").references(() => tenants.id),
  username: text("username").notNull(),
  email: text("email").notNull(),
  password: text("password").notNull(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  role: userRoleEnum("role").notNull().default("employee"),
  phone: text("phone"),
  profileImageUrl: text("profile_image_url"),
  isActive: boolean("is_active").default(true),
  lastLoginAt: timestamp("last_login_at"),
  failedLoginAttempts: integer("failed_login_attempts").default(0),
  lockedUntil: timestamp("locked_until"),
  passwordChangedAt: timestamp("password_changed_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_users_tenant_id").on(table.tenantId),
  index("idx_users_tenant_role").on(table.tenantId, table.role),
  index("idx_users_tenant_active").on(table.tenantId, table.isActive),
  uniqueIndex("users_tenant_email_unique").on(table.tenantId, table.email),
  uniqueIndex("users_tenant_username_unique").on(table.tenantId, table.username),
]);

export const employees = pgTable("employees", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id),
  tenantId: integer("tenant_id").references(() => tenants.id),
  employeeNumber: text("employee_number"),
  dateOfBirth: date("date_of_birth"),
  nationalInsurance: text("national_insurance"),
  maritalStatus: text("marital_status"),
  gender: text("gender"),
  nationality: text("nationality"),
  addressLine1: text("address_line_1"),
  addressLine2: text("address_line_2"),
  city: text("city"),
  county: text("county"),
  postcode: text("postcode"),
  country: text("country").default("United Kingdom"),
  startDate: date("start_date"),
  jobTitle: text("job_title"),
  department: text("department"),
  employmentType: text("employment_type"),
  hourlyRate: text("hourly_rate"),
  uniformSize: text("uniform_size"),
  bootSize: text("boot_size"),
  equipmentNotes: text("equipment_notes"),
  placeOfBirth: text("place_of_birth"),
  siaLicenseNumber: text("sia_license_number"),
  siaLicenseType: text("sia_license_type"),
  siaExpiryDate: date("sia_expiry_date"),
  siaLastVerifiedAt: timestamp("sia_last_verified_at"),
  siaRegisterStatus: text("sia_register_status"),
  siaRegisterHolderName: text("sia_register_holder_name"),
  dbsCertificateNumber: text("dbs_certificate_number"),
  dbsIssueDate: date("dbs_issue_date"),
  hasFirstAid: boolean("has_first_aid").default(false),
  firstAidExpiry: date("first_aid_expiry"),
  supplierId: integer("supplier_id").references(() => suppliers.id),
  externalId: text("external_id"),
  lastSyncedAt: timestamp("last_synced_at"),
  portalAccessEnabled: boolean("portal_access_enabled").default(false),
  portalEmail: text("portal_email"),
  portalInvitationSentAt: timestamp("portal_invitation_sent_at"),
  portalInvitationAccepted: boolean("portal_invitation_accepted").default(false),
  isMerged: boolean("is_merged").default(false),
  mergedIntoId: integer("merged_into_id"),
  mergedAt: timestamp("merged_at"),
  // GFMTrack Staff Profile parity
  officerStep: integer("officer_step").default(0),
  vettingStartDate: date("vetting_start_date"),
  vettingCompleteAt: timestamp("vetting_complete_at"),
  contractEndDate: date("contract_end_date"),
  sageId: text("sage_id"),
  phone: text("phone"),
  secondPhone: text("second_phone"),
  photoUrl: text("photo_url"),
  ethnicOrigin: text("ethnic_origin"),
  paymentType: text("payment_type"),
  permitType: text("permit_type"),
  officerType: text("officer_type"),
  livingFrom: date("living_from"),
  previousAddressLine1: text("previous_address_line_1"),
  previousAddressLine2: text("previous_address_line_2"),
  previousCity: text("previous_city"),
  previousCounty: text("previous_county"),
  previousPostcode: text("previous_postcode"),
  previousLivingFrom: date("previous_living_from"),
  previousLivingTo: date("previous_living_to"),
  carOwner: text("car_owner"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_employees_tenant_id").on(table.tenantId),
  index("idx_employees_tenant_user").on(table.tenantId, table.userId),
  index("idx_employees_tenant_supplier").on(table.tenantId, table.supplierId),
  index("idx_employees_tenant_external").on(table.tenantId, table.externalId),
  uniqueIndex("uq_employees_tenant_external").on(table.tenantId, table.externalId).where(sql`external_id IS NOT NULL`),
]);

export const onboardingRecords = pgTable("onboarding_records", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id),
  tenantId: integer("tenant_id").references(() => tenants.id),
  status: onboardingStatusEnum("status").default("invited"),
  currentStep: integer("current_step").default(1),
  totalSteps: integer("total_steps").default(10),
  personalDetailsComplete: boolean("personal_details_complete").default(false),
  contactDetailsComplete: boolean("contact_details_complete").default(false),
  emergencyContactComplete: boolean("emergency_contact_complete").default(false),
  bankDetailsComplete: boolean("bank_details_complete").default(false),
  documentsComplete: boolean("documents_complete").default(false),
  vettingComplete: boolean("vetting_complete").default(false),
  uniformComplete: boolean("uniform_complete").default(false),
  termsAccepted: boolean("terms_accepted").default(false),
  termsAcceptedAt: timestamp("terms_accepted_at"),
  submittedAt: timestamp("submitted_at"),
  reviewedBy: varchar("reviewed_by").references(() => users.id),
  reviewedAt: timestamp("reviewed_at"),
  reviewNotes: text("review_notes"),
  completedAt: timestamp("completed_at"),
  inviteToken: text("invite_token"),
  inviteExpiresAt: timestamp("invite_expires_at"),
  deadline: timestamp("deadline"),
  lastReminderSentAt: timestamp("last_reminder_sent_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_onboarding_tenant_id").on(table.tenantId),
  index("idx_onboarding_tenant_user").on(table.tenantId, table.userId),
]);

export const emergencyContacts = pgTable("emergency_contacts", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id").references(() => employees.id),
  name: text("name").notNull(),
  relationship: text("relationship").notNull(),
  phone: text("phone").notNull(),
  alternatePhone: text("alternate_phone"),
  email: text("email"),
  address: text("address"),
  isPrimary: boolean("is_primary").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const bankDetails = pgTable("bank_details", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id").references(() => employees.id),
  accountName: text("account_name").notNull(),
  bankName: text("bank_name").notNull(),
  sortCode: text("sort_code").notNull(),
  accountNumber: text("account_number").notNull(),
  buildingSocietyRef: text("building_society_ref"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const pendingBankChanges = pgTable("pending_bank_changes", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id").references(() => employees.id).notNull(),
  requestedByUserId: varchar("requested_by_user_id").references(() => users.id).notNull(),
  accountName: text("account_name").notNull(),
  bankName: text("bank_name").notNull(),
  sortCode: text("sort_code").notNull(),
  accountNumber: text("account_number").notNull(),
  buildingSocietyRef: text("building_society_ref"),
  status: text("status").notNull().default("pending"),
  reviewedByUserId: varchar("reviewed_by_user_id").references(() => users.id),
  reviewedAt: timestamp("reviewed_at"),
  reviewNote: text("review_note"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_pending_bank_changes_employee").on(table.employeeId),
  index("idx_pending_bank_changes_status").on(table.status),
]);

export type PendingBankChange = typeof pendingBankChanges.$inferSelect;
export const insertPendingBankChangeSchema = createInsertSchema(pendingBankChanges).omit({ id: true, createdAt: true });
export type InsertPendingBankChange = z.infer<typeof insertPendingBankChangeSchema>;

export const documents = pgTable("documents", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id").references(() => employees.id),
  tenantId: integer("tenant_id").references(() => tenants.id),
  documentType: text("document_type").notNull(),
  fileName: text("file_name").notNull(),
  fileUrl: text("file_url").notNull(),
  fileSize: integer("file_size"),
  mimeType: text("mime_type"),
  expiryDate: date("expiry_date"),
  isVerified: boolean("is_verified").default(false),
  verifiedBy: varchar("verified_by").references(() => users.id),
  verifiedAt: timestamp("verified_at"),
  notes: text("notes"),
  externalUploadedAt: timestamp("external_uploaded_at"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_documents_tenant_employee").on(table.tenantId, table.employeeId),
]);

export const vettingRecords = pgTable("vetting_records", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id").references(() => employees.id),
  tenantId: integer("tenant_id").references(() => tenants.id),
  checkType: text("check_type").notNull(),
  status: vettingStatusEnum("status").default("not_started"),
  referenceNumber: text("reference_number"),
  requestedDate: date("requested_date"),
  completedDate: date("completed_date"),
  expiryDate: date("expiry_date"),
  result: text("result"),
  notes: text("notes"),
  conductedBy: varchar("conducted_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_vetting_tenant_employee").on(table.tenantId, table.employeeId),
]);

export const auditLogs = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenants.id),
  userId: varchar("user_id").references(() => users.id),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id"),
  details: jsonb("details"),
  ipAddress: text("ip_address"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_audit_logs_tenant_created").on(table.tenantId, table.createdAt),
  index("idx_audit_logs_tenant_entity").on(table.tenantId, table.entityType),
]);

export const references = pgTable("references", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id").references(() => employees.id),
  refereeName: text("referee_name").notNull(),
  refereeEmail: text("referee_email"),
  refereePhone: text("referee_phone"),
  company: text("company").notNull(),
  jobTitle: text("job_title"),
  relationship: text("relationship"),
  dateFrom: date("date_from"),
  dateTo: date("date_to"),
  status: vettingStatusEnum("status").default("not_started"),
  responseReceived: boolean("response_received").default(false),
  responseDate: timestamp("response_date"),
  verificationStatus: text("verification_status"),
  notes: text("notes"),
  requestCount: integer("request_count").default(0),
  requestedDate: date("requested_date"),
  infoSupplied: boolean("info_supplied"),
  howLongKnown: text("how_long_known"),
  screeningComments: text("screening_comments"),
  referenceKind: text("reference_kind").default("personal"),
  refereeAddress: text("referee_address"),
  refereePostcode: text("referee_postcode"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const employmentHistory = pgTable("employment_history", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id").references(() => employees.id),
  employerName: text("employer_name").notNull(),
  jobTitle: text("job_title").notNull(),
  dateFrom: date("date_from").notNull(),
  dateTo: date("date_to"),
  isCurrent: boolean("is_current").default(false),
  reasonForLeaving: text("reason_for_leaving"),
  duties: text("duties"),
  verificationStatus: text("verification_status"),
  submittedDate: date("submitted_date"),
  refereeAddress: text("referee_address"),
  refereePostcode: text("referee_postcode"),
  requestCount: integer("request_count").default(0),
  requestedDate: date("requested_date"),
  refereePhone: text("referee_phone"),
  refereeEmail: text("referee_email"),
  confirmedFrom: date("confirmed_from"),
  confirmedTo: date("confirmed_to"),
  screeningComments: text("screening_comments"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const sitePreferenceTypeEnum = pgEnum("site_preference_type", ["preferred", "banned"]);
export const pFormStatusEnum = pgEnum("p_form_status", ["locked", "pending", "finished"]);
export const rightOfWorkStatusEnum = pgEnum("right_of_work_status", ["pending", "valid", "expired", "rejected"]);

export const employeeAddressHistory = pgTable("employee_address_history", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id").references(() => employees.id).notNull(),
  tenantId: integer("tenant_id").references(() => tenants.id),
  addressLine1: text("address_line_1").notNull(),
  addressLine2: text("address_line_2"),
  city: text("city"),
  county: text("county"),
  postcode: text("postcode"),
  livingFrom: date("living_from"),
  livingTo: date("living_to"),
  isCurrent: boolean("is_current").default(false),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_emp_address_history_employee").on(table.employeeId),
]);

export const employeeNotes = pgTable("employee_notes", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id").references(() => employees.id).notNull(),
  tenantId: integer("tenant_id").references(() => tenants.id),
  body: text("body").notNull(),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_employee_notes_employee").on(table.employeeId),
]);

export const employeePreferredSites = pgTable("employee_preferred_sites", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id").references(() => employees.id).notNull(),
  tenantId: integer("tenant_id").references(() => tenants.id),
  siteId: integer("site_id").notNull(),
  preferenceType: sitePreferenceTypeEnum("preference_type").notNull().default("preferred"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_emp_preferred_sites_employee").on(table.employeeId),
]);

export const employeeEducation = pgTable("employee_education", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id").references(() => employees.id).notNull(),
  tenantId: integer("tenant_id").references(() => tenants.id),
  institution: text("institution").notNull(),
  qualification: text("qualification"),
  dateFrom: date("date_from"),
  dateTo: date("date_to"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_employee_education_employee").on(table.employeeId),
]);

export const employeeDrivingLicences = pgTable("employee_driving_licences", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id").references(() => employees.id).notNull(),
  tenantId: integer("tenant_id").references(() => tenants.id),
  licenceNumber: text("licence_number"),
  categories: text("categories"),
  issueDate: date("issue_date"),
  expiryDate: date("expiry_date"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_employee_driving_employee").on(table.employeeId),
]);

export const employeeHealth = pgTable("employee_health", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id").references(() => employees.id).notNull(),
  tenantId: integer("tenant_id").references(() => tenants.id),
  height: text("height"),
  weight: text("weight"),
  colourOfEyes: text("colour_of_eyes"),
  heartProblems: text("heart_problems"),
  eyeProblems: text("eye_problems"),
  earProblems: text("ear_problems"),
  backProblems: text("back_problems"),
  chestProblems: text("chest_problems"),
  asthma: text("asthma"),
  depression: text("depression"),
  skinRashes: text("skin_rashes"),
  diabetes: text("diabetes"),
  beenIll: text("been_ill"),
  arthritis: text("arthritis"),
  cough: text("cough"),
  currentIllness: text("current_illness"),
  colorBlind: text("color_blind"),
  smoke: text("smoke"),
  jaundice: text("jaundice"),
  migraine: text("migraine"),
  seriouslyInjured: text("seriously_injured"),
  disability: text("disability"),
  nerve: text("nerve"),
  tendons: text("tendons"),
  rheumaticFever: text("rheumatic_fever"),
  rupture: text("rupture"),
  nasalProblems: text("nasal_problems"),
  highBloodPressure: text("high_blood_pressure"),
  updatedAt: timestamp("updated_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  uniqueIndex("uq_employee_health_employee").on(table.employeeId),
]);

export const employeeCertificates = pgTable("employee_certificates", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id").references(() => employees.id).notNull(),
  tenantId: integer("tenant_id").references(() => tenants.id),
  name: text("name").notNull(),
  issuer: text("issuer"),
  issueDate: date("issue_date"),
  expiryDate: date("expiry_date"),
  fileUrl: text("file_url"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_employee_certificates_employee").on(table.employeeId),
]);

export const employeeSiaLicences = pgTable("employee_sia_licences", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id").references(() => employees.id).notNull(),
  tenantId: integer("tenant_id").references(() => tenants.id),
  siaNumber: text("sia_number").notNull(),
  expiryDate: date("expiry_date"),
  licenceSector: text("licence_sector"),
  isDefault: boolean("is_default").default(false),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_employee_sia_licences_employee").on(table.employeeId),
]);

export const pFormRecords = pgTable("p_form_records", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id").references(() => employees.id).notNull(),
  tenantId: integer("tenant_id").references(() => tenants.id),
  status: pFormStatusEnum("status").notNull().default("locked"),
  unlockedAt: timestamp("unlocked_at"),
  unlockedBy: varchar("unlocked_by").references(() => users.id),
  finishedAt: timestamp("finished_at"),
  pdfUrl: text("pdf_url"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  uniqueIndex("uq_p_form_employee").on(table.employeeId),
]);

export const vettingAuditEvents = pgTable("vetting_audit_events", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id").references(() => employees.id).notNull(),
  tenantId: integer("tenant_id").references(() => tenants.id),
  code: text("code").notNull(),
  action: text("action").notNull(),
  details: text("details"),
  colorKey: text("color_key"),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_vetting_audit_employee").on(table.employeeId),
]);

export const rightOfWorkChecks = pgTable("right_of_work_checks", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id").references(() => employees.id).notNull(),
  tenantId: integer("tenant_id").references(() => tenants.id),
  lastUploadAt: timestamp("last_upload_at"),
  nextReviewAt: timestamp("next_review_at"),
  status: rightOfWorkStatusEnum("status").default("pending"),
  notes: text("notes"),
  documentId: integer("document_id").references(() => documents.id),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_row_checks_employee").on(table.employeeId),
]);

export const shiftStatusEnum = pgEnum("shift_status", [
  "scheduled", "in_progress", "completed", "cancelled", "no_show", "booked_on", "booked_off", "verified", "missed"
]);

export const financeApprovalStatusEnum = pgEnum("finance_approval_status", [
  "pending", "approved", "rejected"
]);

export const supplierApprovalStatusEnum = pgEnum("supplier_approval_status", [
  "pending", "approved", "disputed", "resolved"
]);

export const disputeStatusEnum = pgEnum("dispute_status", [
  "open", "under_review", "resolved", "escalated", "closed"
]);

export const payrollStatusEnum = pgEnum("payroll_status", [
  "pending", "approved", "rejected", "paid"
]);

export const payrollRunStatusEnum = pgEnum("payroll_run_status", [
  "draft", "finalised", "paid"
]);

export const invoiceTypeEnum = pgEnum("invoice_type", [
  "manual", "self_billed"
]);

export const creditNoteStatusEnum = pgEnum("credit_note_status", [
  "draft", "issued", "applied", "cancelled"
]);

export const incidentSeverityEnum = pgEnum("incident_severity", [
  "low", "medium", "high", "critical"
]);

export const incidentStatusEnum = pgEnum("incident_status", [
  "reported", "investigating", "resolved", "closed"
]);

export const clients = pgTable("clients", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenants.id),
  clientCode: text("client_code"),
  companyName: text("company_name").notNull(),
  companyRegNumber: text("company_reg_number"),
  contactName: text("contact_name"),
  contactEmail: text("contact_email"),
  contactPhone: text("contact_phone"),
  address: text("address"),
  city: text("city"),
  postcode: text("postcode"),
  contractRef: text("contract_ref"),
  contractStartDate: date("contract_start_date"),
  contractEndDate: date("contract_end_date"),
  billingEmail: text("billing_email"),
  externalId: text("external_id"),
  lastSyncedAt: timestamp("last_synced_at"),
  notes: text("notes"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_clients_tenant_id").on(table.tenantId),
  index("idx_clients_tenant_external").on(table.tenantId, table.externalId),
  uniqueIndex("uq_clients_tenant_external").on(table.tenantId, table.externalId).where(sql`external_id IS NOT NULL`),
]);

export const clientRateCards = pgTable("client_rate_cards", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenants.id).notNull(),
  clientId: integer("client_id").references(() => clients.id).notNull(),
  siteId: integer("site_id").references(() => sites.id),
  roleType: text("role_type"),
  hourlyChargeRate: numeric("hourly_charge_rate", { precision: 10, scale: 2 }).notNull(),
  effectiveFrom: date("effective_from").notNull(),
  effectiveTo: date("effective_to"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_client_rate_cards_tenant_client").on(table.tenantId, table.clientId),
]);

export const sites = pgTable("sites", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenants.id),
  clientId: integer("client_id").references(() => clients.id),
  siteCode: text("site_code"),
  name: text("name").notNull(),
  address: text("address").notNull(),
  city: text("city"),
  postcode: text("postcode"),
  latitude: text("latitude"),
  longitude: text("longitude"),
  clientName: text("client_name"),
  clientContact: text("client_contact"),
  clientEmail: text("client_email"),
  clientPhone: text("client_phone"),
  contractRef: text("contract_ref"),
  externalId: text("external_id"),
  lastSyncedAt: timestamp("last_synced_at"),
  isActive: boolean("is_active").default(true),
  notes: text("notes"),
  shiftPatterns: jsonb("shift_patterns"),
  geofenceRadiusMetres: integer("geofence_radius_metres"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_sites_tenant_id").on(table.tenantId),
  index("idx_sites_tenant_client").on(table.tenantId, table.clientId),
  index("idx_sites_tenant_external").on(table.tenantId, table.externalId),
  uniqueIndex("uq_sites_tenant_external").on(table.tenantId, table.externalId).where(sql`external_id IS NOT NULL`),
]);

export const shifts = pgTable("shifts", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenants.id),
  siteId: integer("site_id").references(() => sites.id),
  employeeId: integer("employee_id").references(() => employees.id),
  supplierId: integer("supplier_id").references(() => suppliers.id),
  shiftCode: text("shift_code"),
  title: text("title").notNull(),
  date: date("date").notNull(),
  startTime: text("start_time").notNull(),
  endTime: text("end_time").notNull(),
  breakMinutes: integer("break_minutes").default(0),
  status: shiftStatusEnum("status").default("scheduled"),
  notes: text("notes"),
  controllerNotes: text("controller_notes"),
  precheckData: jsonb("precheck_data").$type<{
    siaValid?: boolean;
    dbsValid?: boolean;
    uniformConfirmed?: boolean;
    equipmentConfirmed?: boolean;
    welfareChecked?: boolean;
    checkedBy?: string;
    checkedAt?: string;
    passed?: boolean;
    failReason?: string;
  }>(),
  lastCheckInLat: text("last_check_in_lat"),
  lastCheckInLng: text("last_check_in_lng"),
  lastCheckInAddress: text("last_check_in_address"),
  lastCheckOutLat: text("last_check_out_lat"),
  lastCheckOutLng: text("last_check_out_lng"),
  lastCheckOutAddress: text("last_check_out_address"),
  checkInDistanceMetres: numeric("check_in_distance_metres", { precision: 10, scale: 2 }),
  checkOutDistanceMetres: numeric("check_out_distance_metres", { precision: 10, scale: 2 }),
  checkInTime: timestamp("check_in_time"),
  checkOutTime: timestamp("check_out_time"),
  supplierApprovalStatus: supplierApprovalStatusEnum("supplier_approval_status").default("pending"),
  supplierApprovalComment: text("supplier_approval_comment"),
  supplierApprovedAt: timestamp("supplier_approved_at"),
  supplierApprovedBy: varchar("supplier_approved_by"),
  payrollStatus: payrollStatusEnum("payroll_status").default("pending"),
  payrollApprovedAt: timestamp("payroll_approved_at"),
  payrollApprovedBy: varchar("payroll_approved_by").references(() => users.id),
  payrollRejectedReason: text("payroll_rejected_reason"),
  payrollPaidAt: timestamp("payroll_paid_at"),
  payrollRunId: integer("payroll_run_id"),
  bookedOnAt: timestamp("booked_on_at"),
  bookedOffAt: timestamp("booked_off_at"),
  bookedOnBy: varchar("booked_on_by").references(() => users.id),
  bookedOffBy: varchar("booked_off_by").references(() => users.id),
  verifiedAt: timestamp("verified_at"),
  verifiedBy: varchar("verified_by").references(() => users.id),
  financeStatus: financeApprovalStatusEnum("finance_status").default("pending"),
  financeApprovedBy: varchar("finance_approved_by").references(() => users.id),
  financeApprovedAt: timestamp("finance_approved_at"),
  financeNote: text("finance_note"),
  externalId: text("external_id"),
  lastSyncedAt: timestamp("last_synced_at"),
  handoverNotes: text("handover_notes"),
  lateMinutes: integer("late_minutes").default(0),
  payRate: numeric("pay_rate", { precision: 10, scale: 2 }),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_shifts_tenant_id").on(table.tenantId),
  index("idx_shifts_tenant_date").on(table.tenantId, table.date),
  index("idx_shifts_tenant_supplier").on(table.tenantId, table.supplierId),
  index("idx_shifts_tenant_employee").on(table.tenantId, table.employeeId),
  index("idx_shifts_tenant_site").on(table.tenantId, table.siteId),
  index("idx_shifts_tenant_status").on(table.tenantId, table.status),
  index("idx_shifts_tenant_external").on(table.tenantId, table.externalId),
  uniqueIndex("uq_shifts_tenant_external").on(table.tenantId, table.externalId).where(sql`external_id IS NOT NULL`),
]);

export const incidents = pgTable("incidents", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenants.id),
  siteId: integer("site_id").references(() => sites.id),
  reportedBy: varchar("reported_by").references(() => users.id),
  assignedTo: varchar("assigned_to").references(() => users.id),
  incidentRef: text("incident_ref"),
  title: text("title").notNull(),
  description: text("description").notNull(),
  severity: incidentSeverityEnum("severity").default("medium"),
  status: incidentStatusEnum("status").default("reported"),
  incidentDate: timestamp("incident_date").defaultNow(),
  resolvedAt: timestamp("resolved_at"),
  resolution: text("resolution"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_incidents_tenant_id").on(table.tenantId),
  index("idx_incidents_tenant_site").on(table.tenantId, table.siteId),
]);

export const supplierStatusEnum = pgEnum("supplier_status", [
  "draft", "pending", "submitted", "approved", "info_required", "active", "suspended", "terminated"
]);

export const supplierTypeEnum = pgEnum("supplier_type", [
  "labour", "non_labour"
]);

export const invoiceStatusEnum = pgEnum("invoice_status", [
  "draft", "pending", "approved", "paid", "overdue", "cancelled"
]);

export const applicationStatusEnum = pgEnum("application_status", [
  "applied", "screening", "interview", "offer", "hired", "rejected", "withdrawn"
]);

export const suppliers = pgTable("suppliers", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenants.id),
  supplierCode: text("supplier_code"),
  companyName: text("company_name").notNull(),
  contactName: text("contact_name"),
  email: text("email"),
  phone: text("phone"),
  address: text("address"),
  city: text("city"),
  postcode: text("postcode"),
  // Supplier type (Labour / Non-labour) — Story 1
  supplierType: supplierTypeEnum("supplier_type"),
  // Company profile — Story 2
  registeredOfficeAddress: text("registered_office_address"),
  registeredOfficeCity: text("registered_office_city"),
  registeredOfficePostcode: text("registered_office_postcode"),
  registeredOfficeCountry: text("registered_office_country"),
  tradingSameAsRegistered: boolean("trading_same_as_registered").default(true),
  tradingAddress: text("trading_address"),
  tradingCity: text("trading_city"),
  tradingPostcode: text("trading_postcode"),
  financeContactName: text("finance_contact_name"),
  financeContactEmail: text("finance_contact_email"),
  natureOfSupply: text("nature_of_supply"),
  // VAT — Story 3
  vatNumber: text("vat_number"),
  vatStatus: text("vat_status"), // "vat_registered" | "not_vat_registered"
  vatRegisteredFrom: text("vat_registered_from"),
  defaultVatRate: numeric("default_vat_rate", { precision: 5, scale: 2 }).default("20"),
  nonVatReason: text("non_vat_reason"),
  nonVatDeclarationAccepted: boolean("non_vat_declaration_accepted").default(false),
  companyRegNumber: text("company_reg_number"),
  // Companies House profile (from lookup)
  companyCategory: text("company_category"),
  companyStatus: text("company_status"),
  countryOfOrigin: text("country_of_origin"),
  incorporationDate: text("incorporation_date"),
  sicCodes: text("sic_codes"),
  // Accounts (Companies House)
  accountsNextDue: text("accounts_next_due"),
  accountsLastMadeUpDate: text("accounts_last_made_up_date"),
  accountCategory: text("account_category"),
  accountsAccountRefDay: text("accounts_account_ref_day"),
  accountsAccountRefMonth: text("accounts_account_ref_month"),
  returnsNextDue: text("returns_next_due"),
  returnsLastMadeUpDate: text("returns_last_made_up_date"),
  previousNames: jsonb("previous_names").$type<Array<{ CompanyName?: string; CONDate?: string }>>(),
  mortgages: jsonb("mortgages").$type<{ NumMortCharges?: string; NumMortOutstanding?: string; NumMortPartSatisfied?: string; NumMortSatisfied?: string }>(),
  bankName: text("bank_name"),
  accountName: text("account_name"), // account name (match legal name) — Story 4
  sortCode: text("sort_code"),
  accountNumber: text("account_number"),
  status: supplierStatusEnum("status").default("draft"),
  approvedBy: varchar("approved_by").references(() => users.id),
  approvedAt: timestamp("approved_at"),
  submittedAt: timestamp("submitted_at"),
  submittedBy: varchar("submitted_by").references(() => users.id),
  infoRequiredNotes: text("info_required_notes"),
  infoRequiredAt: timestamp("info_required_at"),
  infoRequiredBy: varchar("info_required_by").references(() => users.id),
  suspensionReason: text("suspension_reason"),
  suspendedAt: timestamp("suspended_at"),
  suspendedBy: varchar("suspended_by").references(() => users.id),
  notes: text("notes"),
  portalAccessEnabled: boolean("portal_access_enabled").default(false),
  portalEmail: text("portal_email"),
  dataVisibilityMonths: integer("data_visibility_months"),
  userId: varchar("user_id").references(() => users.id),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  // Labour section — Story 5
  whoEmploysWorkers: text("who_employs_workers"), // "supplier" | "umbrella" | "subcontractor"
  umbrellaName: text("umbrella_name"),
  umbrellaCrn: text("umbrella_crn"),
  subcontractorName: text("subcontractor_name"),
  subcontractorCrn: text("subcontractor_crn"),
  subcontractingYes: boolean("subcontracting_yes").default(false),
  payeCompliance: boolean("paye_compliance").default(false),
  rtwCompliance: boolean("rtw_compliance").default(false),
  nmwCompliance: boolean("nmw_compliance").default(false),
  // Periodic review — Story 13 (Labour: 3 months; Non-labour: 12 months)
  lastReviewAt: timestamp("last_review_at"),
  lastReviewBy: varchar("last_review_by").references(() => users.id),
  nextReviewDueAt: timestamp("next_review_due_at"),
  agreementRegisteredAddress: text("agreement_registered_address"),
  agreementRegisteredCity: text("agreement_registered_city"),
  agreementRegisteredPostcode: text("agreement_registered_postcode"),
  agreementRegisteredCountry: text("agreement_registered_country"),
  selfBillingAgreementStatus: text("self_billing_agreement_status").default("none"),
  selfBillingSignatoryName: text("self_billing_signatory_name"),
  selfBillingSignatoryPosition: text("self_billing_signatory_position"),
  selfBillingAcceptedAt: timestamp("self_billing_accepted_at"),
  selfBillingExpiryDate: timestamp("self_billing_expiry_date"),
  selfBillingAgreementRef: text("self_billing_agreement_ref"),
  selfBillingSignatureData: text("self_billing_signature_data"),
  selfBillingSignedIp: text("self_billing_signed_ip"),
  billingFrequency: text("billing_frequency").default("monthly"),
  rateType: text("rate_type").default("rate_card"),
  externalId: text("external_id"),
  lastSyncedAt: timestamp("last_synced_at"),
  ipPool: text("ip_pool").array(),
}, (table) => [
  index("idx_suppliers_tenant_id").on(table.tenantId),
  index("idx_suppliers_tenant_external").on(table.tenantId, table.externalId),
  index("idx_suppliers_tenant_status").on(table.tenantId, table.status),
  uniqueIndex("uq_suppliers_tenant_external").on(table.tenantId, table.externalId).where(sql`external_id IS NOT NULL`),
]);

export const supplierDocumentTypeEnum = pgEnum("supplier_document_type", [
  "companies_house_proof", "bank_proof", "supplier_declaration",
  "vat_evidence", "sample_vat_invoice", "non_vat_declaration",
  "el_insurance", "pl_insurance", "rtw_payroll_statement", "labour_supply_chain_statement",
  "self_billing_agreement",
  "other"
]);

export const supplierDocumentStatusEnum = pgEnum("supplier_document_status", [
  "pending", "approved", "rejected"
]);

export const supplierDocuments = pgTable("supplier_documents", {
  id: serial("id").primaryKey(),
  supplierId: integer("supplier_id").references(() => suppliers.id).notNull(),
  documentType: supplierDocumentTypeEnum("document_type").notNull(),
  fileName: text("file_name").notNull(),
  fileUrl: text("file_url").notNull(),
  fileSize: integer("file_size"),
  mimeType: text("mime_type"),
  version: integer("version").default(1),
  uploadedBy: varchar("uploaded_by").references(() => users.id),
  status: supplierDocumentStatusEnum("status").default("pending"),
  rejectionReason: text("rejection_reason"),
  reviewedBy: varchar("reviewed_by").references(() => users.id),
  reviewedAt: timestamp("reviewed_at"),
  displayName: text("display_name"),
  expiryDate: date("expiry_date"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_supplier_docs_supplier_id").on(table.supplierId),
]);

export const supplierDocumentAuditActionEnum = pgEnum("supplier_document_audit_action", [
  "uploaded", "approved", "rejected"
]);

export const supplierDocumentAudit = pgTable("supplier_document_audit", {
  id: serial("id").primaryKey(),
  documentId: integer("document_id").references(() => supplierDocuments.id).notNull(),
  action: supplierDocumentAuditActionEnum("action").notNull(),
  userId: varchar("user_id").references(() => users.id),
  details: jsonb("details"), // e.g. { reason }, or {} for approve/upload
  createdAt: timestamp("created_at").defaultNow(),
});

export const employeeInvitations = pgTable("employee_invitations", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id").references(() => employees.id).notNull(),
  email: text("email").notNull(),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  acceptedAt: timestamp("accepted_at"),
  reminderSentAt: timestamp("reminder_sent_at"),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const supplierInvitations = pgTable("supplier_invitations", {
  id: serial("id").primaryKey(),
  supplierId: integer("supplier_id").references(() => suppliers.id).notNull(),
  email: text("email").notNull(),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  acceptedAt: timestamp("accepted_at"),
  reminderSentAt: timestamp("reminder_sent_at"),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const supplierPendingChangeStatusEnum = pgEnum("supplier_pending_change_status", [
  "pending", "approved", "rejected"
]);

export const supplierPendingChanges = pgTable("supplier_pending_changes", {
  id: serial("id").primaryKey(),
  supplierId: integer("supplier_id").references(() => suppliers.id).notNull(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  payload: jsonb("payload").notNull(),
  status: supplierPendingChangeStatusEnum("status").default("pending"),
  reviewedBy: varchar("reviewed_by").references(() => users.id),
  reviewedAt: timestamp("reviewed_at"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_supplier_pending_changes_supplier").on(table.supplierId),
]);

export const supplierLoginActivity = pgTable("supplier_login_activity", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  supplierId: integer("supplier_id").references(() => suppliers.id).notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  location: text("location"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_supplier_login_supplier_created").on(table.supplierId, table.createdAt),
]);

/** In-app notifications for admin (supplier change pending, etc.) and supplier (field requested, change approved/rejected, document). */
export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  type: text("type").notNull(), // 'supplier_change_pending' | 'field_request' | 'change_approved' | 'change_rejected' | 'document_rejected' | 'document_approved'
  title: text("title").notNull(),
  body: text("body"),
  link: text("link"), // e.g. /suppliers/123 or /supplier-portal
  relatedEntityType: text("related_entity_type"), // 'supplier'
  relatedEntityId: text("related_entity_id"), // supplier id
  metadata: jsonb("metadata"), // { fieldKey, changeId, documentId, supplierName, etc. }
  readAt: timestamp("read_at"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_notifications_user_id").on(table.userId),
  index("idx_notifications_user_read").on(table.userId, table.readAt),
]);

/** Admin requests that supplier provide or update a specific profile field. */
export const supplierFieldRequests = pgTable("supplier_field_requests", {
  id: serial("id").primaryKey(),
  supplierId: integer("supplier_id").references(() => suppliers.id).notNull(),
  fieldKey: text("field_key").notNull(),
  message: text("message"),
  requestedBy: varchar("requested_by").references(() => users.id).notNull(),
  requestedAt: timestamp("requested_at").defaultNow(),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_supplier_field_requests_supplier").on(table.supplierId),
]);

/** Log every profile change: direct edit by supplier/admin or applied pending change. */
export const supplierProfileChangeLog = pgTable("supplier_profile_change_log", {
  id: serial("id").primaryKey(),
  supplierId: integer("supplier_id").references(() => suppliers.id).notNull(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  action: text("action").notNull(), // 'direct_edit' | 'pending_approved' | 'pending_rejected'
  fieldChanges: jsonb("field_changes").$type<Array<{ field: string; oldValue: unknown; newValue: unknown }>>(),
  pendingChangeId: integer("pending_change_id"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_supplier_change_log_supplier").on(table.supplierId),
]);

export const supplierPolicyStatusEnum = pgEnum("supplier_policy_status", [
  "pending", "approved", "rejected"
]);

export const supplierPolicies = pgTable("supplier_policies", {
  id: serial("id").primaryKey(),
  supplierId: integer("supplier_id").references(() => suppliers.id).notNull(),
  policyType: text("policy_type").notNull(),
  fileName: text("file_name").notNull(),
  fileUrl: text("file_url").notNull(),
  fileSize: integer("file_size"),
  mimeType: text("mime_type"),
  issueDate: date("issue_date"),
  expiryDate: date("expiry_date"),
  notes: text("notes"),
  version: integer("version").default(1),
  uploadedBy: varchar("uploaded_by").references(() => users.id),
  status: supplierPolicyStatusEnum("status").default("pending"),
  rejectionReason: text("rejection_reason"),
  reviewedBy: varchar("reviewed_by").references(() => users.id),
  reviewedAt: timestamp("reviewed_at"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_supplier_policies_supplier_status").on(table.supplierId, table.status),
]);

export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const invoices = pgTable("invoices", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenants.id),
  supplierId: integer("supplier_id").references(() => suppliers.id),
  fmSupplierId: integer("fm_supplier_id"),
  employeeId: integer("employee_id").references(() => employees.id),
  invoiceNumber: text("invoice_number").notNull(),
  invoiceType: invoiceTypeEnum("invoice_type").default("manual"),
  periodStart: date("period_start").notNull(),
  periodEnd: date("period_end").notNull(),
  totalHours: numeric("total_hours", { precision: 10, scale: 2 }),
  hourlyRate: numeric("hourly_rate", { precision: 10, scale: 2 }),
  subtotal: numeric("subtotal", { precision: 12, scale: 2 }).notNull(),
  vatRate: numeric("vat_rate", { precision: 5, scale: 2 }).default("20"),
  vatAmount: numeric("vat_amount", { precision: 12, scale: 2 }).notNull(),
  totalAmount: numeric("total_amount", { precision: 12, scale: 2 }).notNull(),
  status: invoiceStatusEnum("status").default("draft"),
  dueDate: date("due_date"),
  paidAt: timestamp("paid_at"),
  paidBy: varchar("paid_by").references(() => users.id),
  paymentDate: date("payment_date"),
  issuedAt: timestamp("issued_at"),
  issuedBy: varchar("issued_by").references(() => users.id),
  acceptedAt: timestamp("accepted_at"),
  acceptedBySupplierUserId: varchar("accepted_by_supplier_user_id").references(() => users.id),
  notes: text("notes"),
  approvedTimesheetCount: integer("approved_timesheet_count"),
  billingPeriod: text("billing_period"),
  generatedAt: timestamp("generated_at"),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_invoices_tenant_id").on(table.tenantId),
  index("idx_invoices_tenant_supplier").on(table.tenantId, table.supplierId),
  index("idx_invoices_tenant_status").on(table.tenantId, table.status),
]);

export const invoiceLineItems = pgTable("invoice_line_items", {
  id: serial("id").primaryKey(),
  invoiceId: integer("invoice_id").references(() => invoices.id).notNull(),
  shiftId: integer("shift_id").references(() => shifts.id),
  fmJobId: integer("fm_job_id"),
  description: text("description"),
  hours: numeric("hours", { precision: 10, scale: 2 }).notNull(),
  rate: numeric("rate", { precision: 10, scale: 2 }).notNull(),
  subtotal: numeric("subtotal", { precision: 12, scale: 2 }).notNull(),
  vatRate: numeric("vat_rate", { precision: 5, scale: 2 }).default("20"),
  vatAmount: numeric("vat_amount", { precision: 12, scale: 2 }),
  lineTotal: numeric("line_total", { precision: 12, scale: 2 }),
  chargeRate: numeric("charge_rate", { precision: 10, scale: 2 }),
  chargeAmount: numeric("charge_amount", { precision: 12, scale: 2 }),
  originalHours: numeric("original_hours", { precision: 10, scale: 2 }),
  originalSubtotal: numeric("original_subtotal", { precision: 12, scale: 2 }),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_invoice_line_items_invoice").on(table.invoiceId),
]);

export const rateCards = pgTable("rate_cards", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenants.id).notNull(),
  supplierId: integer("supplier_id").references(() => suppliers.id).notNull(),
  siteId: integer("site_id").references(() => sites.id),
  employeeId: integer("employee_id").references(() => employees.id),
  roleType: text("role_type"),
  hourlyRate: numeric("hourly_rate", { precision: 10, scale: 2 }).notNull(),
  overtimeRate: numeric("overtime_rate", { precision: 10, scale: 2 }),
  effectiveFrom: date("effective_from").notNull(),
  effectiveTo: date("effective_to"),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_rate_cards_tenant_supplier").on(table.tenantId, table.supplierId),
]);

export const payrollRuns = pgTable("payroll_runs", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenants.id).notNull(),
  runCode: text("run_code"),
  periodStart: date("period_start").notNull(),
  periodEnd: date("period_end").notNull(),
  totalHours: numeric("total_hours", { precision: 10, scale: 2 }).default("0"),
  totalGross: numeric("total_gross", { precision: 12, scale: 2 }).default("0"),
  totalDeductions: numeric("total_deductions", { precision: 12, scale: 2 }).default("0"),
  totalNet: numeric("total_net", { precision: 12, scale: 2 }).default("0"),
  shiftCount: integer("shift_count").default(0),
  employeeCount: integer("employee_count").default(0),
  status: payrollRunStatusEnum("status").default("draft"),
  finalisedAt: timestamp("finalised_at"),
  finalisedBy: varchar("finalised_by").references(() => users.id),
  paidAt: timestamp("paid_at"),
  paidBy: varchar("paid_by").references(() => users.id),
  notes: text("notes"),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_payroll_runs_tenant_id").on(table.tenantId),
  index("idx_payroll_runs_tenant_status").on(table.tenantId, table.status),
]);

export const payrollRunItems = pgTable("payroll_run_items", {
  id: serial("id").primaryKey(),
  payrollRunId: integer("payroll_run_id").references(() => payrollRuns.id).notNull(),
  shiftId: integer("shift_id").references(() => shifts.id).notNull(),
  employeeId: integer("employee_id").references(() => employees.id).notNull(),
  hours: numeric("hours", { precision: 10, scale: 2 }).notNull(),
  hourlyRate: numeric("hourly_rate", { precision: 10, scale: 2 }).notNull(),
  grossAmount: numeric("gross_amount", { precision: 12, scale: 2 }).notNull(),
  deductions: numeric("deductions", { precision: 12, scale: 2 }).default("0"),
  netAmount: numeric("net_amount", { precision: 12, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_payroll_run_items_run").on(table.payrollRunId),
  index("idx_payroll_run_items_employee").on(table.employeeId),
]);

export const disputes = pgTable("disputes", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenants.id).notNull(),
  shiftId: integer("shift_id").references(() => shifts.id).notNull(),
  supplierId: integer("supplier_id").references(() => suppliers.id).notNull(),
  status: disputeStatusEnum("status").default("open").notNull(),
  reason: text("reason").notNull(),
  resolution: text("resolution"),
  resolvedBy: varchar("resolved_by").references(() => users.id),
  resolvedAt: timestamp("resolved_at"),
  escalatedAt: timestamp("escalated_at"),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_disputes_tenant_supplier").on(table.tenantId, table.supplierId),
]);

export const disputeMessages = pgTable("dispute_messages", {
  id: serial("id").primaryKey(),
  disputeId: integer("dispute_id").references(() => disputes.id).notNull(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  userName: text("user_name"),
  message: text("message").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_dispute_messages_dispute").on(table.disputeId),
]);

export const creditNotes = pgTable("credit_notes", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenants.id).notNull(),
  invoiceId: integer("invoice_id").references(() => invoices.id).notNull(),
  creditNoteNumber: text("credit_note_number").notNull(),
  reason: text("reason").notNull(),
  subtotal: numeric("subtotal", { precision: 12, scale: 2 }).notNull(),
  vatRate: numeric("vat_rate", { precision: 5, scale: 2 }).default("20"),
  vatAmount: numeric("vat_amount", { precision: 12, scale: 2 }).notNull(),
  totalAmount: numeric("total_amount", { precision: 12, scale: 2 }).notNull(),
  status: creditNoteStatusEnum("status").default("draft").notNull(),
  issuedBy: varchar("issued_by").references(() => users.id),
  issuedAt: timestamp("issued_at"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_credit_notes_tenant_invoice").on(table.tenantId, table.invoiceId),
]);

export const debitNotes = pgTable("debit_notes", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenants.id).notNull(),
  invoiceId: integer("invoice_id").references(() => invoices.id).notNull(),
  debitNoteNumber: text("debit_note_number").notNull(),
  reason: text("reason").notNull(),
  subtotal: numeric("subtotal", { precision: 12, scale: 2 }).notNull(),
  vatRate: numeric("vat_rate", { precision: 5, scale: 2 }).default("20"),
  vatAmount: numeric("vat_amount", { precision: 12, scale: 2 }).notNull(),
  totalAmount: numeric("total_amount", { precision: 12, scale: 2 }).notNull(),
  status: creditNoteStatusEnum("status").default("draft").notNull(),
  issuedBy: varchar("issued_by").references(() => users.id),
  issuedAt: timestamp("issued_at"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_debit_notes_tenant_invoice").on(table.tenantId, table.invoiceId),
]);

export const creditNoteLineItems = pgTable("credit_note_line_items", {
  id: serial("id").primaryKey(),
  creditNoteId: integer("credit_note_id").references(() => creditNotes.id).notNull(),
  description: text("description"),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  vatRate: numeric("vat_rate", { precision: 5, scale: 2 }).default("20"),
  vatAmount: numeric("vat_amount", { precision: 12, scale: 2 }),
  lineTotal: numeric("line_total", { precision: 12, scale: 2 }),
  createdAt: timestamp("created_at").defaultNow(),
});

export const debitNoteLineItems = pgTable("debit_note_line_items", {
  id: serial("id").primaryKey(),
  debitNoteId: integer("debit_note_id").references(() => debitNotes.id).notNull(),
  description: text("description"),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  vatRate: numeric("vat_rate", { precision: 5, scale: 2 }).default("20"),
  vatAmount: numeric("vat_amount", { precision: 12, scale: 2 }),
  lineTotal: numeric("line_total", { precision: 12, scale: 2 }),
  createdAt: timestamp("created_at").defaultNow(),
});

export const jobPostings = pgTable("job_postings", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenants.id),
  jobRef: text("job_ref"),
  title: text("title").notNull(),
  department: text("department"),
  location: text("location"),
  employmentType: text("employment_type"),
  description: text("description").notNull(),
  requirements: text("requirements"),
  hourlyRate: text("hourly_rate"),
  siteId: integer("site_id").references(() => sites.id),
  isActive: boolean("is_active").default(true),
  closingDate: date("closing_date"),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_job_postings_tenant_id").on(table.tenantId),
]);

export const applicants = pgTable("applicants", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenants.id),
  jobPostingId: integer("job_posting_id").references(() => jobPostings.id),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  cvUrl: text("cv_url"),
  coverLetter: text("cover_letter"),
  status: applicationStatusEnum("status").default("applied"),
  interviewDate: timestamp("interview_date"),
  interviewNotes: text("interview_notes"),
  interviewLocation: text("interview_location"),
  interviewLink: text("interview_link"),
  interviewerName: text("interviewer_name"),
  interviewerId: varchar("interviewer_id").references(() => users.id),
  rating: integer("rating"),
  notes: text("notes"),
  source: text("source"),
  offerDate: date("offer_date"),
  offerSalary: numeric("offer_salary", { precision: 10, scale: 2 }),
  offerStatus: text("offer_status"),
  offerLetterUrl: text("offer_letter_url"),
  offerEmailSentAt: timestamp("offer_email_sent_at"),
  offerResponseToken: text("offer_response_token"),
  offerRespondedAt: timestamp("offer_responded_at"),
  hiredAt: timestamp("hired_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_applicants_tenant_job").on(table.tenantId, table.jobPostingId),
]);

export const subscriptionPlanEnum = pgEnum("subscription_plan", [
  "starter", "professional", "enterprise"
]);

export const subscriptionPlans = pgTable("subscription_plans", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: subscriptionPlanEnum("slug").notNull().unique(),
  price: text("price").notNull(),
  maxEmployees: integer("max_employees").notNull(),
  maxSites: integer("max_sites").notNull(),
  maxAdminUsers: integer("max_admin_users").notNull(),
  features: jsonb("features").$type<string[]>().default([]),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const tenantInvitations = pgTable("tenant_invitations", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenants.id),
  email: text("email").notNull(),
  firstName: text("first_name"),
  lastName: text("last_name"),
  role: userRoleEnum("role").notNull().default("employee"),
  token: text("token").notNull().unique(),
  invitedBy: varchar("invited_by").references(() => users.id),
  status: text("status").notNull().default("pending"),
  acceptedAt: timestamp("accepted_at"),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_tenant_invitations_tenant").on(table.tenantId),
]);

export const dataConsentStatusEnum = pgEnum("data_consent_status", [
  "granted", "withdrawn"
]);

export const dataConsents = pgTable("data_consents", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  tenantId: integer("tenant_id").references(() => tenants.id),
  consentType: text("consent_type").notNull(),
  status: dataConsentStatusEnum("status").notNull().default("granted"),
  grantedAt: timestamp("granted_at").defaultNow(),
  withdrawnAt: timestamp("withdrawn_at"),
  ipAddress: text("ip_address"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const erasureRequestStatusEnum = pgEnum("erasure_request_status", [
  "pending", "approved", "rejected", "completed"
]);

export const dataErasureRequests = pgTable("data_erasure_requests", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  tenantId: integer("tenant_id").references(() => tenants.id),
  reason: text("reason"),
  status: erasureRequestStatusEnum("status").notNull().default("pending"),
  reviewedBy: varchar("reviewed_by").references(() => users.id),
  reviewedAt: timestamp("reviewed_at"),
  reviewNotes: text("review_notes"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Insert schemas
export const insertDataConsentSchema = createInsertSchema(dataConsents).omit({ id: true, createdAt: true });
export const insertDataErasureRequestSchema = createInsertSchema(dataErasureRequests).omit({ id: true, createdAt: true });
export const insertSubscriptionPlanSchema = createInsertSchema(subscriptionPlans).omit({ id: true, createdAt: true });
export const insertTenantInvitationSchema = createInsertSchema(tenantInvitations).omit({ id: true, createdAt: true });
export const insertTenantSchema = createInsertSchema(tenants).omit({ id: true, createdAt: true });
export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true, updatedAt: true, lastLoginAt: true });
export const insertEmployeeSchema = createInsertSchema(employees).omit({ id: true, createdAt: true, updatedAt: true });
export const insertOnboardingSchema = createInsertSchema(onboardingRecords).omit({ id: true, createdAt: true, updatedAt: true });
export const insertEmergencyContactSchema = createInsertSchema(emergencyContacts).omit({ id: true, createdAt: true });
export const insertBankDetailsSchema = createInsertSchema(bankDetails).omit({ id: true, createdAt: true, updatedAt: true });
export const insertDocumentSchema = createInsertSchema(documents).omit({ id: true, createdAt: true });
export const insertVettingRecordSchema = createInsertSchema(vettingRecords).omit({ id: true, createdAt: true, updatedAt: true });
export const insertAuditLogSchema = createInsertSchema(auditLogs).omit({ id: true, createdAt: true });
export const insertReferenceSchema = createInsertSchema(references).omit({ id: true, createdAt: true });
export const insertEmploymentHistorySchema = createInsertSchema(employmentHistory).omit({ id: true, createdAt: true });
export const insertEmployeeAddressHistorySchema = createInsertSchema(employeeAddressHistory).omit({ id: true, createdAt: true });
export const insertEmployeeNoteSchema = createInsertSchema(employeeNotes).omit({ id: true, createdAt: true });
export const insertEmployeePreferredSiteSchema = createInsertSchema(employeePreferredSites).omit({ id: true, createdAt: true });
export const insertEmployeeEducationSchema = createInsertSchema(employeeEducation).omit({ id: true, createdAt: true });
export const insertEmployeeDrivingLicenceSchema = createInsertSchema(employeeDrivingLicences).omit({ id: true, createdAt: true });
export const insertEmployeeHealthSchema = createInsertSchema(employeeHealth).omit({ id: true, createdAt: true, updatedAt: true });
export const insertEmployeeCertificateSchema = createInsertSchema(employeeCertificates).omit({ id: true, createdAt: true });
export const insertEmployeeSiaLicenceSchema = createInsertSchema(employeeSiaLicences).omit({ id: true, createdAt: true });
export const insertPFormRecordSchema = createInsertSchema(pFormRecords).omit({ id: true, createdAt: true, updatedAt: true });
export const insertVettingAuditEventSchema = createInsertSchema(vettingAuditEvents).omit({ id: true, createdAt: true });
export const insertRightOfWorkCheckSchema = createInsertSchema(rightOfWorkChecks).omit({ id: true, createdAt: true });
export const insertClientSchema = createInsertSchema(clients).omit({ id: true, createdAt: true });
export const insertSiteSchema = createInsertSchema(sites).omit({ id: true, createdAt: true });
export const insertShiftSchema = createInsertSchema(shifts).omit({ id: true, createdAt: true, updatedAt: true });
export const insertIncidentSchema = createInsertSchema(incidents).omit({ id: true, createdAt: true, updatedAt: true });
export const insertSupplierSchema = createInsertSchema(suppliers).omit({ id: true, createdAt: true, updatedAt: true });
export const insertSupplierDocumentSchema = createInsertSchema(supplierDocuments).omit({ id: true, createdAt: true });
export const insertSupplierDocumentAuditSchema = createInsertSchema(supplierDocumentAudit).omit({ id: true, createdAt: true });
export const insertEmployeeInvitationSchema = createInsertSchema(employeeInvitations).omit({ id: true, createdAt: true });
export const insertSupplierInvitationSchema = createInsertSchema(supplierInvitations).omit({ id: true, createdAt: true });
export const insertSupplierPendingChangeSchema = createInsertSchema(supplierPendingChanges).omit({ id: true, createdAt: true });
export const insertSupplierLoginActivitySchema = createInsertSchema(supplierLoginActivity).omit({ id: true, createdAt: true });
export const insertNotificationSchema = createInsertSchema(notifications).omit({ id: true, createdAt: true });
export const insertSupplierFieldRequestSchema = createInsertSchema(supplierFieldRequests).omit({ id: true, createdAt: true });
export const insertSupplierProfileChangeLogSchema = createInsertSchema(supplierProfileChangeLog).omit({ id: true, createdAt: true });
export const insertPasswordResetTokenSchema = createInsertSchema(passwordResetTokens).omit({ id: true, createdAt: true });
export const insertSupplierPolicySchema = createInsertSchema(supplierPolicies).omit({ id: true, createdAt: true });
export const insertInvoiceSchema = createInsertSchema(invoices).omit({ id: true, createdAt: true, updatedAt: true });
export const insertInvoiceLineItemSchema = createInsertSchema(invoiceLineItems).omit({ id: true, createdAt: true });
export const insertRateCardSchema = createInsertSchema(rateCards).omit({ id: true, createdAt: true });
export const insertClientRateCardSchema = createInsertSchema(clientRateCards).omit({ id: true, createdAt: true });
export const insertDisputeSchema = createInsertSchema(disputes).omit({ id: true, createdAt: true });
export const insertDisputeMessageSchema = createInsertSchema(disputeMessages).omit({ id: true, createdAt: true });
export const insertCreditNoteSchema = createInsertSchema(creditNotes).omit({ id: true, createdAt: true });
export const insertDebitNoteSchema = createInsertSchema(debitNotes).omit({ id: true, createdAt: true });
export const insertCreditNoteLineItemSchema = createInsertSchema(creditNoteLineItems).omit({ id: true, createdAt: true });
export const insertDebitNoteLineItemSchema = createInsertSchema(debitNoteLineItems).omit({ id: true, createdAt: true });
export const insertPayrollRunSchema = createInsertSchema(payrollRuns).omit({ id: true, createdAt: true });
export const insertPayrollRunItemSchema = createInsertSchema(payrollRunItems).omit({ id: true, createdAt: true });
export const insertJobPostingSchema = createInsertSchema(jobPostings).omit({ id: true, createdAt: true, updatedAt: true });
export const insertApplicantSchema = createInsertSchema(applicants).omit({ id: true, createdAt: true, updatedAt: true });

// Types
export type Tenant = typeof tenants.$inferSelect;
export type InsertTenant = z.infer<typeof insertTenantSchema>;
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Employee = typeof employees.$inferSelect;
export type InsertEmployee = z.infer<typeof insertEmployeeSchema>;
export type OnboardingRecord = typeof onboardingRecords.$inferSelect;
export type InsertOnboardingRecord = z.infer<typeof insertOnboardingSchema>;
export type EmergencyContact = typeof emergencyContacts.$inferSelect;
export type InsertEmergencyContact = z.infer<typeof insertEmergencyContactSchema>;
export type BankDetail = typeof bankDetails.$inferSelect;
export type InsertBankDetail = z.infer<typeof insertBankDetailsSchema>;
export type Document = typeof documents.$inferSelect;
export type InsertDocument = z.infer<typeof insertDocumentSchema>;
export type VettingRecord = typeof vettingRecords.$inferSelect;
export type InsertVettingRecord = z.infer<typeof insertVettingRecordSchema>;
export type AuditLog = typeof auditLogs.$inferSelect;
export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;
export type Reference = typeof references.$inferSelect;
export type InsertReference = z.infer<typeof insertReferenceSchema>;
export type EmploymentHistory = typeof employmentHistory.$inferSelect;
export type InsertEmploymentHistory = z.infer<typeof insertEmploymentHistorySchema>;

export const employmentReferenceTokens = pgTable("employment_reference_tokens", {
  id: serial("id").primaryKey(),
  token: varchar("token", { length: 64 }).notNull().unique(),
  tenantId: integer("tenant_id").references(() => tenants.id, { onDelete: "set null" }),
  employeeId: integer("employee_id").references(() => employees.id, { onDelete: "cascade" }).notNull(),
  employmentHistoryId: integer("employment_history_id").references(() => employmentHistory.id, { onDelete: "cascade" }).notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
  informationConfirmed: boolean("information_confirmed"),
  detailsIfDifferent: text("details_if_different"),
  attitude: text("attitude"),
  timeKeeping: text("time_keeping"),
  timeOff: text("time_off"),
  reasonForLeaving: text("reason_for_leaving"),
  wouldReemploy: text("would_reemploy"),
  refereePrintName: text("referee_print_name"),
  refereeCompany: text("referee_company"),
  refereePosition: text("referee_position"),
  refereeSignature: text("referee_signature"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_emp_ref_tokens_token").on(table.token),
  index("idx_emp_ref_tokens_hist").on(table.employmentHistoryId),
]);

export const insertEmploymentReferenceTokenSchema = createInsertSchema(employmentReferenceTokens).omit({ id: true, createdAt: true });
export type EmploymentReferenceToken = typeof employmentReferenceTokens.$inferSelect;
export type InsertEmploymentReferenceToken = z.infer<typeof insertEmploymentReferenceTokenSchema>;

export const personalReferenceTokens = pgTable("personal_reference_tokens", {
  id: serial("id").primaryKey(),
  token: varchar("token", { length: 64 }).notNull().unique(),
  tenantId: integer("tenant_id").references(() => tenants.id, { onDelete: "set null" }),
  employeeId: integer("employee_id").references(() => employees.id, { onDelete: "cascade" }).notNull(),
  referenceId: integer("reference_id").references(() => references.id, { onDelete: "cascade" }).notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
  informationConfirmed: boolean("information_confirmed"),
  detailsIfDifferent: text("details_if_different"),
  characterAssessment: text("character_assessment"),
  trustworthy: text("trustworthy"),
  awareOfConcerns: text("aware_of_concerns"),
  concernsDetails: text("concerns_details"),
  wouldRecommend: text("would_recommend"),
  illegalActivity: text("illegal_activity"),
  honestPerson: text("honest_person"),
  politeConduct: text("polite_conduct"),
  ableToWorkInTeam: text("able_to_work_in_team"),
  trustworthyAndLoyal: text("trustworthy_and_loyal"),
  goodChoiceForPosition: text("good_choice_for_position"),
  reasonIfNo: text("reason_if_no"),
  refereePrintName: text("referee_print_name"),
  refereeOccupation: text("referee_occupation"),
  refereeAddress: text("referee_address"),
  refereeSignature: text("referee_signature"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_personal_ref_tokens_token").on(table.token),
  index("idx_personal_ref_tokens_ref").on(table.referenceId),
]);

export const insertPersonalReferenceTokenSchema = createInsertSchema(personalReferenceTokens).omit({ id: true, createdAt: true });
export type PersonalReferenceToken = typeof personalReferenceTokens.$inferSelect;
export type InsertPersonalReferenceToken = z.infer<typeof insertPersonalReferenceTokenSchema>;

export const vettingPacketTokens = pgTable("vetting_packet_tokens", {
  id: serial("id").primaryKey(),
  token: varchar("token", { length: 64 }).notNull().unique(),
  tenantId: integer("tenant_id").references(() => tenants.id, { onDelete: "set null" }),
  employeeId: integer("employee_id").references(() => employees.id, { onDelete: "cascade" }).notNull(),
  recipientEmail: text("recipient_email").notNull(),
  documentCodes: jsonb("document_codes").$type<string[]>().notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_vetting_packet_tokens_token").on(table.token),
  index("idx_vetting_packet_tokens_employee").on(table.employeeId),
]);

export const insertVettingPacketTokenSchema = createInsertSchema(vettingPacketTokens).omit({ id: true, createdAt: true });
export type VettingPacketToken = typeof vettingPacketTokens.$inferSelect;
export type InsertVettingPacketToken = z.infer<typeof insertVettingPacketTokenSchema>;

export const employeeVettingFormTokens = pgTable("employee_vetting_form_tokens", {
  id: serial("id").primaryKey(),
  token: varchar("token", { length: 64 }).notNull().unique(),
  tenantId: integer("tenant_id").references(() => tenants.id, { onDelete: "set null" }),
  employeeId: integer("employee_id").references(() => employees.id, { onDelete: "cascade" }).notNull(),
  recipientEmail: text("recipient_email").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  lastSavedAt: timestamp("last_saved_at"),
  submittedAt: timestamp("submitted_at"),
  formData: jsonb("form_data").$type<Record<string, unknown>>(),
  equalOpsAcknowledgedAt: timestamp("equal_ops_acknowledged_at"),
  zeroHoursAcknowledgedAt: timestamp("zero_hours_acknowledged_at"),
  codeOfConductAcknowledgedAt: timestamp("code_of_conduct_acknowledged_at"),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_emp_vetting_form_tokens_token").on(table.token),
  index("idx_emp_vetting_form_tokens_employee").on(table.employeeId),
]);

export const insertEmployeeVettingFormTokenSchema = createInsertSchema(employeeVettingFormTokens).omit({ id: true, createdAt: true });
export type EmployeeVettingFormToken = typeof employeeVettingFormTokens.$inferSelect;
export type InsertEmployeeVettingFormToken = z.infer<typeof insertEmployeeVettingFormTokenSchema>;

export type EmployeeAddressHistory = typeof employeeAddressHistory.$inferSelect;
export type InsertEmployeeAddressHistory = z.infer<typeof insertEmployeeAddressHistorySchema>;
export type EmployeeNote = typeof employeeNotes.$inferSelect;
export type InsertEmployeeNote = z.infer<typeof insertEmployeeNoteSchema>;
export type EmployeePreferredSite = typeof employeePreferredSites.$inferSelect;
export type InsertEmployeePreferredSite = z.infer<typeof insertEmployeePreferredSiteSchema>;
export type EmployeeEducation = typeof employeeEducation.$inferSelect;
export type InsertEmployeeEducation = z.infer<typeof insertEmployeeEducationSchema>;
export type EmployeeDrivingLicence = typeof employeeDrivingLicences.$inferSelect;
export type InsertEmployeeDrivingLicence = z.infer<typeof insertEmployeeDrivingLicenceSchema>;
export type EmployeeHealth = typeof employeeHealth.$inferSelect;
export type InsertEmployeeHealth = z.infer<typeof insertEmployeeHealthSchema>;
export type EmployeeCertificate = typeof employeeCertificates.$inferSelect;
export type InsertEmployeeCertificate = z.infer<typeof insertEmployeeCertificateSchema>;
export type EmployeeSiaLicence = typeof employeeSiaLicences.$inferSelect;
export type InsertEmployeeSiaLicence = z.infer<typeof insertEmployeeSiaLicenceSchema>;
export type PFormRecord = typeof pFormRecords.$inferSelect;
export type InsertPFormRecord = z.infer<typeof insertPFormRecordSchema>;
export type VettingAuditEvent = typeof vettingAuditEvents.$inferSelect;
export type InsertVettingAuditEvent = z.infer<typeof insertVettingAuditEventSchema>;
export type RightOfWorkCheck = typeof rightOfWorkChecks.$inferSelect;
export type InsertRightOfWorkCheck = z.infer<typeof insertRightOfWorkCheckSchema>;
export type Client = typeof clients.$inferSelect;
export type InsertClient = z.infer<typeof insertClientSchema>;
export type Site = typeof sites.$inferSelect;
export type InsertSite = z.infer<typeof insertSiteSchema>;
export type Shift = typeof shifts.$inferSelect;
export type InsertShift = z.infer<typeof insertShiftSchema>;
export type Incident = typeof incidents.$inferSelect;
export type InsertIncident = z.infer<typeof insertIncidentSchema>;
export type Supplier = typeof suppliers.$inferSelect;
export type InsertSupplier = z.infer<typeof insertSupplierSchema>;
export type SupplierDocument = typeof supplierDocuments.$inferSelect;
export type InsertSupplierDocument = z.infer<typeof insertSupplierDocumentSchema>;
export type SupplierDocumentAudit = typeof supplierDocumentAudit.$inferSelect;
export type InsertSupplierDocumentAudit = z.infer<typeof insertSupplierDocumentAuditSchema>;
export type EmployeeInvitation = typeof employeeInvitations.$inferSelect;
export type InsertEmployeeInvitation = z.infer<typeof insertEmployeeInvitationSchema>;
export type SupplierInvitation = typeof supplierInvitations.$inferSelect;
export type InsertSupplierInvitation = z.infer<typeof insertSupplierInvitationSchema>;
export type SupplierPendingChange = typeof supplierPendingChanges.$inferSelect;
export type InsertSupplierPendingChange = z.infer<typeof insertSupplierPendingChangeSchema>;
export type SupplierLoginActivity = typeof supplierLoginActivity.$inferSelect;
export type InsertSupplierLoginActivity = z.infer<typeof insertSupplierLoginActivitySchema>;
export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type SupplierFieldRequest = typeof supplierFieldRequests.$inferSelect;
export type InsertSupplierFieldRequest = z.infer<typeof insertSupplierFieldRequestSchema>;
export type SupplierProfileChangeLog = typeof supplierProfileChangeLog.$inferSelect;
export type InsertSupplierProfileChangeLog = z.infer<typeof insertSupplierProfileChangeLogSchema>;
export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;
export type InsertPasswordResetToken = z.infer<typeof insertPasswordResetTokenSchema>;
export type SupplierPolicy = typeof supplierPolicies.$inferSelect;
export type InsertSupplierPolicy = z.infer<typeof insertSupplierPolicySchema>;
export type Invoice = typeof invoices.$inferSelect;
export type InsertInvoice = z.infer<typeof insertInvoiceSchema>;
export type InvoiceLineItem = typeof invoiceLineItems.$inferSelect;
export type InsertInvoiceLineItem = z.infer<typeof insertInvoiceLineItemSchema>;
export type RateCard = typeof rateCards.$inferSelect;
export type InsertRateCard = z.infer<typeof insertRateCardSchema>;
export type ClientRateCard = typeof clientRateCards.$inferSelect;
export type InsertClientRateCard = z.infer<typeof insertClientRateCardSchema>;
export type Dispute = typeof disputes.$inferSelect;
export type InsertDispute = z.infer<typeof insertDisputeSchema>;
export type DisputeMessage = typeof disputeMessages.$inferSelect;
export type InsertDisputeMessage = z.infer<typeof insertDisputeMessageSchema>;
export type CreditNote = typeof creditNotes.$inferSelect;
export type InsertCreditNote = z.infer<typeof insertCreditNoteSchema>;
export type DebitNote = typeof debitNotes.$inferSelect;
export type InsertDebitNote = z.infer<typeof insertDebitNoteSchema>;
export type CreditNoteLineItem = typeof creditNoteLineItems.$inferSelect;
export type InsertCreditNoteLineItem = z.infer<typeof insertCreditNoteLineItemSchema>;
export type DebitNoteLineItem = typeof debitNoteLineItems.$inferSelect;
export type InsertDebitNoteLineItem = z.infer<typeof insertDebitNoteLineItemSchema>;
export type PayrollRun = typeof payrollRuns.$inferSelect;
export type InsertPayrollRun = z.infer<typeof insertPayrollRunSchema>;
export type PayrollRunItem = typeof payrollRunItems.$inferSelect;
export type InsertPayrollRunItem = z.infer<typeof insertPayrollRunItemSchema>;
export type JobPosting = typeof jobPostings.$inferSelect;
export type InsertJobPosting = z.infer<typeof insertJobPostingSchema>;
export type Applicant = typeof applicants.$inferSelect;
export type InsertApplicant = z.infer<typeof insertApplicantSchema>;
export type SubscriptionPlan = typeof subscriptionPlans.$inferSelect;
export type InsertSubscriptionPlan = z.infer<typeof insertSubscriptionPlanSchema>;
export type TenantInvitation = typeof tenantInvitations.$inferSelect;
export type InsertTenantInvitation = z.infer<typeof insertTenantInvitationSchema>;
export type DataConsent = typeof dataConsents.$inferSelect;
export type InsertDataConsent = z.infer<typeof insertDataConsentSchema>;
export type DataErasureRequest = typeof dataErasureRequests.$inferSelect;
export type InsertDataErasureRequest = z.infer<typeof insertDataErasureRequestSchema>;

export const aiDecisionStatusEnum = pgEnum("ai_decision_status", [
  "suggested", "accepted", "rejected", "modified"
]);

export const aiDecisions = pgTable("ai_decisions", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull(),
  userId: varchar("user_id", { length: 255 }).notNull(),
  siteId: integer("site_id"),
  siteName: varchar("site_name", { length: 255 }),
  shiftDate: varchar("shift_date", { length: 50 }),
  employeeId: integer("employee_id"),
  employeeName: varchar("employee_name", { length: 255 }),
  suggestedShiftTime: varchar("suggested_shift_time", { length: 100 }),
  reason: text("reason"),
  priority: varchar("priority", { length: 20 }),
  status: aiDecisionStatusEnum("status").default("suggested").notNull(),
  feedback: text("feedback"),
  requirements: text("requirements"),
  batchId: varchar("batch_id", { length: 100 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  decidedAt: timestamp("decided_at"),
});

export const insertAiDecisionSchema = createInsertSchema(aiDecisions).omit({ id: true, createdAt: true });

export const aiInsights = pgTable("ai_insights", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull(),
  insightType: varchar("insight_type", { length: 50 }).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description").notNull(),
  severity: varchar("severity", { length: 20 }).default("info").notNull(),
  data: jsonb("data"),
  isActive: boolean("is_active").default(true).notNull(),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertAiInsightSchema = createInsertSchema(aiInsights).omit({ id: true, createdAt: true });

export type AiDecision = typeof aiDecisions.$inferSelect;
export type InsertAiDecision = z.infer<typeof insertAiDecisionSchema>;
export type AiInsight = typeof aiInsights.$inferSelect;
export type InsertAiInsight = z.infer<typeof insertAiInsightSchema>;

export const channelTypeEnum = pgEnum("channel_type", [
  "team", "site", "direct", "broadcast"
]);

export const channels = pgTable("channels", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  type: channelTypeEnum("type").notNull(),
  description: text("description"),
  siteId: integer("site_id"),
  createdBy: varchar("created_by", { length: 255 }).notNull(),
  isArchived: boolean("is_archived").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertChannelSchema = createInsertSchema(channels).omit({ id: true, createdAt: true });

export const channelMembers = pgTable("channel_members", {
  id: serial("id").primaryKey(),
  channelId: integer("channel_id").notNull(),
  userId: varchar("user_id", { length: 255 }).notNull(),
  joinedAt: timestamp("joined_at").defaultNow().notNull(),
  lastReadAt: timestamp("last_read_at"),
});

export const insertChannelMemberSchema = createInsertSchema(channelMembers).omit({ id: true, joinedAt: true });

export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  channelId: integer("channel_id").notNull(),
  senderId: varchar("sender_id", { length: 255 }).notNull(),
  senderName: varchar("sender_name", { length: 255 }).notNull(),
  content: text("content").notNull(),
  isEdited: boolean("is_edited").default(false).notNull(),
  fileUrl: text("file_url"),
  fileName: text("file_name"),
  fileType: text("file_type"),
  fileSize: integer("file_size"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertMessageSchema = createInsertSchema(messages).omit({ id: true, createdAt: true });

export const broadcasts = pgTable("broadcasts", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull(),
  senderId: varchar("sender_id", { length: 255 }).notNull(),
  senderName: varchar("sender_name", { length: 255 }).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  content: text("content").notNull(),
  targetRoles: text("target_roles").array(),
  priority: varchar("priority", { length: 20 }).default("normal").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertBroadcastSchema = createInsertSchema(broadcasts).omit({ id: true, createdAt: true });

export const broadcastReads = pgTable("broadcast_reads", {
  id: serial("id").primaryKey(),
  broadcastId: integer("broadcast_id").notNull(),
  userId: varchar("user_id", { length: 255 }).notNull(),
  readAt: timestamp("read_at").defaultNow().notNull(),
});

export const insertBroadcastReadSchema = createInsertSchema(broadcastReads).omit({ id: true, readAt: true });

export const supplierHmrcEventTypeEnum = pgEnum("supplier_hmrc_event_type", [
  "agreement_created", "agreement_renewed", "agreement_terminated", "agreement_expired",
  "invoice_generated", "invoice_issued", "invoice_viewed", "invoice_accepted", "invoice_disputed", "invoice_paid",
  "credit_note_issued", "debit_note_issued",
  "vat_number_changed", "vat_verification_checked", "vat_status_changed",
  "rate_card_created", "rate_card_updated", "rate_card_expired",
  "timesheet_approved", "timesheet_rejected", "timesheet_resubmitted", "timesheet_linked",
  "supplier_approved", "supplier_terminated", "supplier_status_changed",
  "dispute_opened", "dispute_resolved",
  "audit_accessed"
]);

export const supplierAuditEvents = pgTable("supplier_audit_events", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenants.id).notNull(),
  supplierId: integer("supplier_id").references(() => suppliers.id).notNull(),
  eventType: supplierHmrcEventTypeEnum("event_type").notNull(),
  entityType: text("entity_type"),
  entityId: text("entity_id"),
  actorUserId: varchar("actor_user_id").references(() => users.id),
  actorName: text("actor_name"),
  actorRole: text("actor_role"),
  summary: text("summary").notNull(),
  oldValues: jsonb("old_values"),
  newValues: jsonb("new_values"),
  metadata: jsonb("metadata"),
  ipAddress: text("ip_address"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_supplier_audit_tenant_supplier").on(table.tenantId, table.supplierId),
  index("idx_supplier_audit_supplier_created").on(table.supplierId, table.createdAt),
]);

export const vatVerifications = pgTable("vat_verifications", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenants.id).notNull(),
  supplierId: integer("supplier_id").references(() => suppliers.id).notNull(),
  vatNumber: text("vat_number").notNull(),
  verificationResult: text("verification_result").notNull(),
  verificationMethod: text("verification_method").default("manual"),
  verifiedBy: varchar("verified_by").references(() => users.id),
  verifiedByName: text("verified_by_name"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const rateCardHistory = pgTable("rate_card_history", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenants.id).notNull(),
  supplierId: integer("supplier_id").references(() => suppliers.id).notNull(),
  rateCardId: integer("rate_card_id").references(() => rateCards.id),
  changeType: text("change_type").notNull(),
  roleType: text("role_type"),
  siteId: integer("site_id").references(() => sites.id),
  oldHourlyRate: numeric("old_hourly_rate", { precision: 10, scale: 2 }),
  newHourlyRate: numeric("new_hourly_rate", { precision: 10, scale: 2 }),
  oldOvertimeRate: numeric("old_overtime_rate", { precision: 10, scale: 2 }),
  newOvertimeRate: numeric("new_overtime_rate", { precision: 10, scale: 2 }),
  effectiveFrom: date("effective_from"),
  effectiveTo: date("effective_to"),
  changedBy: varchar("changed_by").references(() => users.id),
  changedByName: text("changed_by_name"),
  reason: text("reason"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertSupplierAuditEventSchema = createInsertSchema(supplierAuditEvents).omit({ id: true, createdAt: true });
export const insertVatVerificationSchema = createInsertSchema(vatVerifications).omit({ id: true, createdAt: true });
export const insertRateCardHistorySchema = createInsertSchema(rateCardHistory).omit({ id: true, createdAt: true });

export type SupplierAuditEvent = typeof supplierAuditEvents.$inferSelect;
export type InsertSupplierAuditEvent = z.infer<typeof insertSupplierAuditEventSchema>;
export type VatVerification = typeof vatVerifications.$inferSelect;
export type InsertVatVerification = z.infer<typeof insertVatVerificationSchema>;
export type RateCardHistory = typeof rateCardHistory.$inferSelect;
export type InsertRateCardHistory = z.infer<typeof insertRateCardHistorySchema>;

export const rolePermissions = pgTable("role_permissions", {
  id: serial("id").primaryKey(),
  role: text("role").notNull(),
  permissionKey: text("permission_key").notNull(),
  enabled: boolean("enabled").notNull().default(true),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertRolePermissionSchema = createInsertSchema(rolePermissions).omit({ id: true, updatedAt: true });
export type RolePermission = typeof rolePermissions.$inferSelect;
export type InsertRolePermission = z.infer<typeof insertRolePermissionSchema>;

export type Channel = typeof channels.$inferSelect;
export type InsertChannel = z.infer<typeof insertChannelSchema>;
export type ChannelMember = typeof channelMembers.$inferSelect;
export type InsertChannelMember = z.infer<typeof insertChannelMemberSchema>;
export type Message = typeof messages.$inferSelect;
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Broadcast = typeof broadcasts.$inferSelect;
export type InsertBroadcast = z.infer<typeof insertBroadcastSchema>;
export type BroadcastRead = typeof broadcastReads.$inferSelect;
export type InsertBroadcastRead = z.infer<typeof insertBroadcastReadSchema>;

export const pushSubscriptions = pgTable("push_subscriptions", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id", { length: 255 }).notNull(),
  endpoint: text("endpoint").notNull(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertPushSubscriptionSchema = createInsertSchema(pushSubscriptions).omit({ id: true, createdAt: true });
export type PushSubscription = typeof pushSubscriptions.$inferSelect;
export type InsertPushSubscription = z.infer<typeof insertPushSubscriptionSchema>;

export const mobilePushTokens = pgTable("mobile_push_tokens", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id", { length: 255 }).notNull(),
  token: text("token").notNull(),
  platform: varchar("platform", { length: 20 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertMobilePushTokenSchema = createInsertSchema(mobilePushTokens).omit({ id: true, createdAt: true });
export type MobilePushToken = typeof mobilePushTokens.$inferSelect;
export type InsertMobilePushToken = z.infer<typeof insertMobilePushTokenSchema>;

export const tenantAddons = pgTable("tenant_addons", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull(),
  addonKey: text("addon_key").notNull(),
  addonName: text("addon_name").notNull(),
  status: text("status").notNull().default("inactive"),
  stripeProductId: text("stripe_product_id"),
  stripePriceId: text("stripe_price_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  stripeCustomerId: text("stripe_customer_id"),
  purchasedAt: timestamp("purchased_at"),
  expiresAt: timestamp("expires_at"),
  purchasedByUserId: varchar("purchased_by_user_id"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertTenantAddonSchema = createInsertSchema(tenantAddons).omit({ id: true, createdAt: true, updatedAt: true });
export type TenantAddon = typeof tenantAddons.$inferSelect;
export type InsertTenantAddon = z.infer<typeof insertTenantAddonSchema>;

// ── FM Services Add-on Tables ──

export const fmWorkers = pgTable("fm_workers", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id),
  userId: varchar("user_id").references(() => users.id),
  displayId: text("display_id"),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email"),
  phone: text("phone"),
  trade: text("trade").notNull(),
  serviceLine: text("service_line").notNull().default("cleaning"),
  skills: text("skills").array(),
  certifications: jsonb("certifications").$type<Array<{ name: string; expiresAt?: string; reference?: string }>>(),
  hourlyRate: numeric("hourly_rate", { precision: 10, scale: 2 }),
  address: text("address"),
  postcode: text("postcode"),
  notes: text("notes"),
  isActive: boolean("is_active").default(true),
  externalId: text("external_id"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_fm_workers_tenant").on(table.tenantId),
  index("idx_fm_workers_tenant_active").on(table.tenantId, table.isActive),
  index("idx_fm_workers_tenant_service").on(table.tenantId, table.serviceLine),
]);

export const fmSuppliers = pgTable("fm_suppliers", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id),
  displayId: text("display_id"),
  companyName: text("company_name").notNull(),
  serviceLines: text("service_lines").array(),
  contactName: text("contact_name"),
  email: text("email"),
  phone: text("phone"),
  address: text("address"),
  postcode: text("postcode"),
  vatNumber: text("vat_number"),
  companyNumber: text("company_number"),
  insuranceExpiresAt: date("insurance_expires_at"),
  agreementSignedAt: date("agreement_signed_at"),
  defaultHourlyRate: numeric("default_hourly_rate", { precision: 10, scale: 2 }),
  notes: text("notes"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_fm_suppliers_tenant").on(table.tenantId),
  index("idx_fm_suppliers_tenant_active").on(table.tenantId, table.isActive),
]);

export const fmJobs = pgTable("fm_jobs", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id),
  siteId: integer("site_id").references(() => sites.id),
  jobNumber: text("job_number"),
  title: text("title").notNull(),
  description: text("description"),
  jobType: text("job_type").notNull().default("reactive"),
  serviceLine: text("service_line").notNull().default("cleaning"),
  priority: text("priority").notNull().default("medium"),
  status: text("status").notNull().default("raised"),
  scheduledDate: date("scheduled_date"),
  scheduledStartTime: text("scheduled_start_time"),
  scheduledEndTime: text("scheduled_end_time"),
  slaDueAt: timestamp("sla_due_at"),
  slaBreached: boolean("sla_breached").default(false),
  estimatedHours: numeric("estimated_hours", { precision: 6, scale: 2 }),
  actualHours: numeric("actual_hours", { precision: 6, scale: 2 }),
  ppmScheduleId: integer("ppm_schedule_id"),
  supplierId: integer("supplier_id").references(() => fmSuppliers.id),
  completionNotes: text("completion_notes"),
  photoUrls: text("photo_urls").array(),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  completedByWorkerId: integer("completed_by_worker_id").references(() => fmWorkers.id),
  signedOffAt: timestamp("signed_off_at"),
  signedOffBy: varchar("signed_off_by").references(() => users.id),
  clientSignatureUrl: text("client_signature_url"),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_fm_jobs_tenant").on(table.tenantId),
  index("idx_fm_jobs_tenant_status").on(table.tenantId, table.status),
  index("idx_fm_jobs_tenant_site").on(table.tenantId, table.siteId),
  index("idx_fm_jobs_tenant_date").on(table.tenantId, table.scheduledDate),
  index("idx_fm_jobs_tenant_service").on(table.tenantId, table.serviceLine),
]);

export const fmJobAssignments = pgTable("fm_job_assignments", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id),
  jobId: integer("job_id").notNull().references(() => fmJobs.id, { onDelete: "cascade" }),
  workerId: integer("worker_id").references(() => fmWorkers.id),
  role: text("role").default("worker"),
  status: text("status").notNull().default("assigned"),
  checkInAt: timestamp("check_in_at"),
  checkOutAt: timestamp("check_out_at"),
  checkInLat: text("check_in_lat"),
  checkInLng: text("check_in_lng"),
  checkInDistanceMetres: numeric("check_in_distance_metres", { precision: 10, scale: 2 }),
  checkInWithinRange: boolean("check_in_within_range"),
  checkOutLat: text("check_out_lat"),
  checkOutLng: text("check_out_lng"),
  checkOutDistanceMetres: numeric("check_out_distance_metres", { precision: 10, scale: 2 }),
  checkOutWithinRange: boolean("check_out_within_range"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_fm_assignments_tenant_job").on(table.tenantId, table.jobId),
  index("idx_fm_assignments_tenant_worker").on(table.tenantId, table.workerId),
]);

export const fmPpmSchedules = pgTable("fm_ppm_schedules", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id),
  siteId: integer("site_id").references(() => sites.id),
  name: text("name").notNull(),
  description: text("description"),
  serviceLine: text("service_line").notNull().default("cleaning"),
  frequency: text("frequency").notNull().default("monthly"),
  intervalDays: integer("interval_days"),
  daysOfWeek: text("days_of_week").array(),
  dayOfMonth: integer("day_of_month"),
  defaultStartTime: text("default_start_time"),
  defaultEndTime: text("default_end_time"),
  estimatedHours: numeric("estimated_hours", { precision: 6, scale: 2 }),
  nextDueDate: date("next_due_date"),
  lastGeneratedDate: date("last_generated_date"),
  defaultSupplierId: integer("default_supplier_id").references(() => fmSuppliers.id),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_fm_ppm_tenant").on(table.tenantId),
  index("idx_fm_ppm_tenant_site").on(table.tenantId, table.siteId),
  index("idx_fm_ppm_tenant_active").on(table.tenantId, table.isActive),
]);

export const insertFmWorkerSchema = createInsertSchema(fmWorkers).omit({ id: true, createdAt: true, updatedAt: true });
export type FmWorker = typeof fmWorkers.$inferSelect;
export type InsertFmWorker = z.infer<typeof insertFmWorkerSchema>;

export const insertFmSupplierSchema = createInsertSchema(fmSuppliers).omit({ id: true, createdAt: true, updatedAt: true });
export type FmSupplier = typeof fmSuppliers.$inferSelect;
export type InsertFmSupplier = z.infer<typeof insertFmSupplierSchema>;

export const insertFmJobSchema = createInsertSchema(fmJobs).omit({ id: true, createdAt: true, updatedAt: true });
export type FmJob = typeof fmJobs.$inferSelect;
export type InsertFmJob = z.infer<typeof insertFmJobSchema>;

export const insertFmJobAssignmentSchema = createInsertSchema(fmJobAssignments).omit({ id: true, createdAt: true });
export type FmJobAssignment = typeof fmJobAssignments.$inferSelect;
export type InsertFmJobAssignment = z.infer<typeof insertFmJobAssignmentSchema>;

export const insertFmPpmScheduleSchema = createInsertSchema(fmPpmSchedules).omit({ id: true, createdAt: true, updatedAt: true });
export type FmPpmSchedule = typeof fmPpmSchedules.$inferSelect;
export type InsertFmPpmSchedule = z.infer<typeof insertFmPpmScheduleSchema>;

export const contactLogs = pgTable("contact_logs", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull(),
  shiftId: integer("shift_id"),
  employeeId: integer("employee_id"),
  employeeName: text("employee_name"),
  employeePhone: text("employee_phone"),
  employeeEmail: text("employee_email"),
  channel: text("channel").notNull(),
  direction: text("direction").notNull().default("outbound"),
  triggerType: text("trigger_type").notNull(),
  subject: text("subject"),
  messageBody: text("message_body"),
  status: text("status").notNull().default("pending"),
  errorMessage: text("error_message"),
  twilioSid: text("twilio_sid"),
  callDurationSeconds: integer("call_duration_seconds"),
  aiTranscript: text("ai_transcript"),
  employeeResponse: text("employee_response"),
  escalationLevel: integer("escalation_level").default(1),
  triggeredBy: text("triggered_by"),
  siteName: text("site_name"),
  shiftDate: text("shift_date"),
  shiftTime: text("shift_time"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertContactLogSchema = createInsertSchema(contactLogs).omit({ id: true, createdAt: true });
export type ContactLog = typeof contactLogs.$inferSelect;
export type InsertContactLog = z.infer<typeof insertContactLogSchema>;

export const employeePolicies = pgTable("employee_policies", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id").notNull(),
  tenantId: integer("tenant_id").notNull(),
  policyName: text("policy_name").notNull(),
  policyType: text("policy_type").notNull().default("policy"),
  version: text("version"),
  fileUrl: text("file_url"),
  issuedAt: timestamp("issued_at").defaultNow().notNull(),
  issuedBy: text("issued_by"),
  acknowledgedAt: timestamp("acknowledged_at"),
  acknowledgedBy: text("acknowledged_by"),
  status: text("status").notNull().default("issued"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertEmployeePolicySchema = createInsertSchema(employeePolicies).omit({ id: true, createdAt: true });
export type EmployeePolicy = typeof employeePolicies.$inferSelect;
export type InsertEmployeePolicy = z.infer<typeof insertEmployeePolicySchema>;

export const employeeAuditTrail = pgTable("employee_audit_trail", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id").notNull(),
  tenantId: integer("tenant_id").notNull(),
  eventType: text("event_type").notNull(),
  eventCategory: text("event_category").notNull().default("general"),
  title: text("title").notNull(),
  description: text("description"),
  performedBy: text("performed_by"),
  performedByName: text("performed_by_name"),
  metadata: text("metadata"),
  eventAt: timestamp("event_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_employee_audit_tenant_employee").on(table.tenantId, table.employeeId),
]);

export const insertEmployeeAuditTrailSchema = createInsertSchema(employeeAuditTrail).omit({ id: true, createdAt: true });
export type EmployeeAuditEvent = typeof employeeAuditTrail.$inferSelect;
export type InsertEmployeeAuditEvent = z.infer<typeof insertEmployeeAuditTrailSchema>;

export const employeePayRates = pgTable("employee_pay_rates", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenants.id).notNull(),
  employeeId: integer("employee_id").references(() => employees.id).notNull(),
  hourlyRate: numeric("hourly_rate", { precision: 10, scale: 2 }).notNull(),
  effectiveFrom: date("effective_from").notNull(),
  effectiveTo: date("effective_to"),
  reason: text("reason"),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_employee_pay_rates_tenant_employee").on(table.tenantId, table.employeeId),
]);

export const insertEmployeePayRateSchema = createInsertSchema(employeePayRates).omit({ id: true, createdAt: true });
export type EmployeePayRate = typeof employeePayRates.$inferSelect;
export type InsertEmployeePayRate = z.infer<typeof insertEmployeePayRateSchema>;

export const documentTemplates = pgTable("document_templates", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenants.id).notNull(),
  name: text("name").notNull(),
  documentType: text("document_type").notNull(),
  isDefault: boolean("is_default").default(false).notNull(),
  headerTitle: text("header_title"),
  headerSubtitle: text("header_subtitle"),
  sections: jsonb("sections"),
  footerText: text("footer_text"),
  complianceText: text("compliance_text"),
  paymentTermsText: text("payment_terms_text"),
  invoiceFormat: text("invoice_format"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_document_templates_tenant_type").on(table.tenantId, table.documentType),
]);

export const insertDocumentTemplateSchema = createInsertSchema(documentTemplates).omit({ id: true, createdAt: true, updatedAt: true });
export type DocumentTemplate = typeof documentTemplates.$inferSelect;
export type InsertDocumentTemplate = z.infer<typeof insertDocumentTemplateSchema>;

export const supplierAgreementArchives = pgTable("supplier_agreement_archives", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull(),
  supplierId: integer("supplier_id").notNull(),
  agreementRef: text("agreement_ref"),
  signatoryName: text("signatory_name"),
  signatoryPosition: text("signatory_position"),
  signedAt: timestamp("signed_at"),
  expiryDate: timestamp("expiry_date"),
  signatureData: text("signature_data"),
  signedIp: text("signed_ip"),
  archivedAt: timestamp("archived_at").defaultNow().notNull(),
  archivedReason: text("archived_reason"),
  templateId: integer("template_id"),
  buyerSignatoryName: text("buyer_signatory_name"),
  buyerSignatoryPosition: text("buyer_signatory_position"),
  buyerSignatureData: text("buyer_signature_data"),
}, (table) => [
  index("idx_supplier_agreement_archives_tenant_supplier").on(table.tenantId, table.supplierId),
]);

export const insertSupplierAgreementArchiveSchema = createInsertSchema(supplierAgreementArchives).omit({ id: true, archivedAt: true });
export type SupplierAgreementArchive = typeof supplierAgreementArchives.$inferSelect;
export type InsertSupplierAgreementArchive = z.infer<typeof insertSupplierAgreementArchiveSchema>;

export const bankTransactions = pgTable("bank_transactions", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenants.id).notNull(),
  transactionDate: date("transaction_date").notNull(),
  description: text("description"),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  type: text("type").notNull().default("debit"),
  accountNumber: text("account_number"),
  reference: text("reference"),
  memo: text("memo"),
  isAllocated: boolean("is_allocated").default(false).notNull(),
  allocatedAmount: numeric("allocated_amount", { precision: 12, scale: 2 }).default("0"),
  supplierId: integer("supplier_id").references(() => suppliers.id),
  importBatchId: text("import_batch_id"),
  rawData: text("raw_data"),
  netAmount: numeric("net_amount", { precision: 12, scale: 2 }),
  vatAmount: numeric("vat_amount", { precision: 12, scale: 2 }),
  isGeneralPurchase: boolean("is_general_purchase").default(false).notNull(),
  expenseCategory: text("expense_category"),
  vendorId: integer("vendor_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_bank_transactions_tenant").on(table.tenantId),
  index("idx_bank_transactions_tenant_date").on(table.tenantId, table.transactionDate),
  index("idx_bank_transactions_batch").on(table.importBatchId),
  index("idx_bank_transactions_tenant_allocated").on(table.tenantId, table.isAllocated),
]);

export const insertBankTransactionSchema = createInsertSchema(bankTransactions).omit({ id: true, createdAt: true });
export type BankTransaction = typeof bankTransactions.$inferSelect;
export type InsertBankTransaction = z.infer<typeof insertBankTransactionSchema>;

export const bankTransactionAllocations = pgTable("bank_transaction_allocations", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenants.id).notNull(),
  bankTransactionId: integer("bank_transaction_id").references(() => bankTransactions.id).notNull(),
  invoiceId: integer("invoice_id").references(() => invoices.id),
  clientInvoiceId: integer("client_invoice_id"),
  supplierId: integer("supplier_id").references(() => suppliers.id),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  allocatedBy: varchar("allocated_by").references(() => users.id),
  allocatedAt: timestamp("allocated_at").defaultNow().notNull(),
  notes: text("notes"),
}, (table) => [
  index("idx_bank_alloc_tenant").on(table.tenantId),
  index("idx_bank_alloc_transaction").on(table.bankTransactionId),
  index("idx_bank_alloc_invoice").on(table.invoiceId),
  index("idx_bank_alloc_supplier").on(table.supplierId),
]);

export const insertBankTransactionAllocationSchema = createInsertSchema(bankTransactionAllocations).omit({ id: true, allocatedAt: true });
export type BankTransactionAllocation = typeof bankTransactionAllocations.$inferSelect;
export type InsertBankTransactionAllocation = z.infer<typeof insertBankTransactionAllocationSchema>;

export const clientInvoices = pgTable("client_invoices", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenants.id).notNull(),
  clientId: integer("client_id").references(() => clients.id).notNull(),
  invoiceNumber: text("invoice_number").notNull(),
  periodStart: date("period_start").notNull(),
  periodEnd: date("period_end").notNull(),
  subtotal: numeric("subtotal", { precision: 12, scale: 2 }).notNull(),
  vatRate: numeric("vat_rate", { precision: 5, scale: 2 }).default("20"),
  vatAmount: numeric("vat_amount", { precision: 12, scale: 2 }).notNull(),
  totalAmount: numeric("total_amount", { precision: 12, scale: 2 }).notNull(),
  status: text("status").notNull().default("draft"),
  dueDate: date("due_date"),
  paidAt: timestamp("paid_at"),
  issuedAt: timestamp("issued_at"),
  notes: text("notes"),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_client_invoices_tenant").on(table.tenantId),
  index("idx_client_invoices_tenant_client").on(table.tenantId, table.clientId),
  index("idx_client_invoices_tenant_status").on(table.tenantId, table.status),
  index("idx_client_invoices_period").on(table.tenantId, table.periodStart, table.periodEnd),
]);

export const insertClientInvoiceSchema = createInsertSchema(clientInvoices).omit({ id: true, createdAt: true });
export type ClientInvoice = typeof clientInvoices.$inferSelect;
export type InsertClientInvoice = z.infer<typeof insertClientInvoiceSchema>;

export const clientInvoiceLineItems = pgTable("client_invoice_line_items", {
  id: serial("id").primaryKey(),
  clientInvoiceId: integer("client_invoice_id").references(() => clientInvoices.id).notNull(),
  shiftId: integer("shift_id").references(() => shifts.id),
  fmJobId: integer("fm_job_id"),
  description: text("description"),
  hours: numeric("hours", { precision: 8, scale: 2 }),
  chargeRate: numeric("charge_rate", { precision: 8, scale: 2 }),
  subtotal: numeric("subtotal", { precision: 10, scale: 2 }),
  vatAmount: numeric("vat_amount", { precision: 10, scale: 2 }),
  lineTotal: numeric("line_total", { precision: 10, scale: 2 }),
}, (table) => [
  index("idx_client_invoice_items_invoice").on(table.clientInvoiceId),
]);

export const insertClientInvoiceLineItemSchema = createInsertSchema(clientInvoiceLineItems).omit({ id: true });
export type ClientInvoiceLineItem = typeof clientInvoiceLineItems.$inferSelect;
export type InsertClientInvoiceLineItem = z.infer<typeof insertClientInvoiceLineItemSchema>;

export const syncConfigurations = pgTable("sync_configurations", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenants.id).notNull(),
  name: text("name").notNull(),
  apiBaseUrl: text("api_base_url").notNull(),
  apiKeyEncrypted: text("api_key_encrypted").notNull(),
  connectionType: text("connection_type").default("rest").notNull(),
  syncEntities: text("sync_entities").array().default(sql`ARRAY['employees','sites','clients','suppliers','shifts']`),
  lastSyncAt: timestamp("last_sync_at"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_sync_configs_tenant").on(table.tenantId),
]);

export const insertSyncConfigurationSchema = createInsertSchema(syncConfigurations).omit({ id: true, createdAt: true, updatedAt: true });
export type SyncConfiguration = typeof syncConfigurations.$inferSelect;
export type InsertSyncConfiguration = z.infer<typeof insertSyncConfigurationSchema>;

export const syncLogs = pgTable("sync_logs", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenants.id).notNull(),
  configId: integer("config_id").references(() => syncConfigurations.id).notNull(),
  syncType: text("sync_type").notNull(),
  status: text("status").notNull().default("running"),
  recordsCreated: integer("records_created").default(0),
  recordsUpdated: integer("records_updated").default(0),
  recordsSkipped: integer("records_skipped").default(0),
  recordsFailed: integer("records_failed").default(0),
  errors: jsonb("errors"),
  entityBreakdown: jsonb("entity_breakdown"),
  startedAt: timestamp("started_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
}, (table) => [
  index("idx_sync_logs_tenant").on(table.tenantId),
  index("idx_sync_logs_config").on(table.configId),
  index("idx_sync_logs_tenant_status").on(table.tenantId, table.status),
]);

export const insertSyncLogSchema = createInsertSchema(syncLogs).omit({ id: true, startedAt: true });
export type SyncLog = typeof syncLogs.$inferSelect;
export type InsertSyncLog = z.infer<typeof insertSyncLogSchema>;

export const classificationRules = pgTable("classification_rules", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenants.id).notNull(),
  matchPattern: text("match_pattern").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: integer("entity_id"),
  expenseCategory: text("expense_category"),
  includesVat: boolean("includes_vat").default(false).notNull(),
  matchCount: integer("match_count").default(1).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_classification_rules_tenant").on(table.tenantId),
  index("idx_classification_rules_tenant_pattern").on(table.tenantId, table.matchPattern),
]);

export const insertClassificationRuleSchema = createInsertSchema(classificationRules).omit({ id: true, createdAt: true, updatedAt: true });
export type ClassificationRule = typeof classificationRules.$inferSelect;
export type InsertClassificationRule = z.infer<typeof insertClassificationRuleSchema>;

export const autoClassificationSuggestions = pgTable("auto_classification_suggestions", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenants.id).notNull(),
  bankTransactionId: integer("bank_transaction_id").references(() => bankTransactions.id).notNull(),
  entityType: text("entity_type").notNull(),
  entityId: integer("entity_id"),
  expenseCategory: text("expense_category"),
  includesVat: boolean("includes_vat").default(false).notNull(),
  confidence: numeric("confidence", { precision: 5, scale: 2 }).notNull(),
  matchReasons: jsonb("match_reasons"),
  status: text("status").notNull().default("pending"),
  invoiceId: integer("invoice_id"),
  vendorId: integer("vendor_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_auto_class_suggestions_tenant").on(table.tenantId),
  index("idx_auto_class_suggestions_tenant_status").on(table.tenantId, table.status),
  index("idx_auto_class_suggestions_transaction").on(table.bankTransactionId),
]);

export const insertAutoClassificationSuggestionSchema = createInsertSchema(autoClassificationSuggestions).omit({ id: true, createdAt: true });
export type AutoClassificationSuggestion = typeof autoClassificationSuggestions.$inferSelect;
export type InsertAutoClassificationSuggestion = z.infer<typeof insertAutoClassificationSuggestionSchema>;

export const purchaseVendors = pgTable("purchase_vendors", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenants.id).notNull(),
  name: text("name").notNull(),
  vatRegistered: boolean("vat_registered").default(false).notNull(),
  vatNumber: text("vat_number"),
  defaultExpenseCategory: text("default_expense_category"),
  bankName: text("bank_name"),
  accountName: text("account_name"),
  sortCode: text("sort_code"),
  accountNumber: text("account_number"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_purchase_vendors_tenant").on(table.tenantId),
  index("idx_purchase_vendors_tenant_active").on(table.tenantId, table.isActive),
]);

export const insertPurchaseVendorSchema = createInsertSchema(purchaseVendors).omit({ id: true, createdAt: true, updatedAt: true });
export type PurchaseVendor = typeof purchaseVendors.$inferSelect;
export type InsertPurchaseVendor = z.infer<typeof insertPurchaseVendorSchema>;

export const reverseEngineerStatusEnum = pgEnum("reverse_engineer_status", [
  "completed", "rolled_back"
]);

export const reverseEngineerLog = pgTable("reverse_engineer_log", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenants.id).notNull(),
  supplierId: integer("supplier_id").references(() => suppliers.id).notNull(),
  supplierName: text("supplier_name").notNull(),
  paymentMonth: text("payment_month").notNull(),
  workMonth: text("work_month").notNull(),
  totalPaymentAmount: numeric("total_payment_amount", { precision: 12, scale: 2 }).notNull(),
  hourlyRateUsed: numeric("hourly_rate_used", { precision: 10, scale: 2 }).notNull(),
  hoursGenerated: numeric("hours_generated", { precision: 12, scale: 2 }).notNull(),
  shiftsGenerated: integer("shifts_generated").notNull(),
  existingHoursBefore: numeric("existing_hours_before", { precision: 12, scale: 2 }).notNull(),
  existingShiftsBefore: integer("existing_shifts_before").notNull(),
  shiftsAdded: integer("shifts_added").notNull(),
  status: reverseEngineerStatusEnum("status").default("completed").notNull(),
  batchId: text("batch_id").notNull(),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  rolledBackAt: timestamp("rolled_back_at"),
  rolledBackBy: varchar("rolled_back_by").references(() => users.id),
}, (table) => [
  index("idx_reverse_engineer_log_tenant").on(table.tenantId),
  index("idx_reverse_engineer_log_supplier").on(table.tenantId, table.supplierId),
  index("idx_reverse_engineer_log_batch").on(table.batchId),
]);

export const insertReverseEngineerLogSchema = createInsertSchema(reverseEngineerLog).omit({ id: true, createdAt: true, rolledBackAt: true, rolledBackBy: true });
export type ReverseEngineerLog = typeof reverseEngineerLog.$inferSelect;
export type InsertReverseEngineerLog = z.infer<typeof insertReverseEngineerLogSchema>;

export const vendorClassifications = pgTable("vendor_classifications", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id),
  vendorName: text("vendor_name").notNull(),
  vatQualifying: boolean("vat_qualifying"),
  expenseCategory: text("expense_category"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  uniqueIndex("idx_vendor_class_tenant_name").on(table.tenantId, table.vendorName),
]);

export const insertVendorClassificationSchema = createInsertSchema(vendorClassifications).omit({ id: true, createdAt: true, updatedAt: true });
export type VendorClassification = typeof vendorClassifications.$inferSelect;
export type InsertVendorClassification = z.infer<typeof insertVendorClassificationSchema>;

export const financialDocumentTypeEnum = pgEnum("financial_document_type", [
  "receipt", "invoice", "statement", "contract", "credit_note", "other"
]);

export const financialDocuments = pgTable("financial_documents", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenants.id).notNull(),
  documentType: financialDocumentTypeEnum("document_type").notNull(),
  fileName: text("file_name").notNull(),
  fileUrl: text("file_url").notNull(),
  fileSize: integer("file_size"),
  mimeType: text("mime_type"),
  title: text("title").notNull(),
  description: text("description"),
  supplierId: integer("supplier_id").references(() => suppliers.id),
  clientId: integer("client_id").references(() => clients.id),
  invoiceId: integer("invoice_id").references(() => invoices.id),
  amount: numeric("amount", { precision: 12, scale: 2 }),
  currency: text("currency").default("GBP"),
  taxYear: text("tax_year"),
  category: text("category"),
  tags: text("tags").array(),
  uploadedBy: varchar("uploaded_by").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_financial_documents_tenant").on(table.tenantId),
  index("idx_financial_documents_tenant_type").on(table.tenantId, table.documentType),
  index("idx_financial_documents_tenant_supplier").on(table.tenantId, table.supplierId),
  index("idx_financial_documents_tenant_client").on(table.tenantId, table.clientId),
]);

export const insertFinancialDocumentSchema = createInsertSchema(financialDocuments).omit({ id: true, createdAt: true });
export type FinancialDocument = typeof financialDocuments.$inferSelect;
export type InsertFinancialDocument = z.infer<typeof insertFinancialDocumentSchema>;

export const complianceAlertLog = pgTable("compliance_alert_log", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenants.id).notNull(),
  entityType: text("entity_type").notNull(),
  entityId: integer("entity_id").notNull(),
  entityName: text("entity_name").notNull(),
  alertType: text("alert_type").notNull(),
  daysBefore: integer("days_before").notNull(),
  recipientEmail: text("recipient_email").notNull(),
  sentAt: timestamp("sent_at").defaultNow(),
}, (table) => [
  index("idx_compliance_alert_log_tenant").on(table.tenantId),
  index("idx_compliance_alert_log_dedup").on(table.tenantId, table.entityType, table.entityId, table.alertType, table.daysBefore),
]);

export const insertComplianceAlertLogSchema = createInsertSchema(complianceAlertLog).omit({ id: true, sentAt: true });
export type ComplianceAlertLog = typeof complianceAlertLog.$inferSelect;
export type InsertComplianceAlertLog = z.infer<typeof insertComplianceAlertLogSchema>;

export const controllerHandoverNotes = pgTable("controller_handover_notes", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenants.id).notNull(),
  createdBy: varchar("created_by").references(() => users.id).notNull(),
  note: text("note").notNull(),
  openIssues: text("open_issues"),
  pendingActions: text("pending_actions"),
  watchItems: text("watch_items"),
  shiftDate: date("shift_date").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_handover_notes_tenant").on(table.tenantId),
  index("idx_handover_notes_tenant_date").on(table.tenantId, table.shiftDate),
]);

export const insertControllerHandoverNoteSchema = createInsertSchema(controllerHandoverNotes).omit({ id: true, createdAt: true });
export type ControllerHandoverNote = typeof controllerHandoverNotes.$inferSelect;
export type InsertControllerHandoverNote = z.infer<typeof insertControllerHandoverNoteSchema>;

export const autoEscalationRules = pgTable("auto_escalation_rules", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenants.id).notNull(),
  name: text("name").notNull(),
  triggerType: text("trigger_type").notNull(),
  delayMinutes: integer("delay_minutes").notNull(),
  actionType: text("action_type").notNull(),
  enabled: boolean("enabled").default(true),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_escalation_rules_tenant").on(table.tenantId),
]);

export const insertAutoEscalationRuleSchema = createInsertSchema(autoEscalationRules).omit({ id: true, createdAt: true });
export type AutoEscalationRule = typeof autoEscalationRules.$inferSelect;
export type InsertAutoEscalationRule = z.infer<typeof insertAutoEscalationRuleSchema>;

export const leaveTypeEnum = pgEnum("leave_type", [
  "annual_leave", "sick_leave", "personal", "training"
]);

export const timeOffStatusEnum = pgEnum("time_off_status", [
  "pending", "approved", "rejected", "cancelled"
]);

export const timeOffRequests = pgTable("time_off_requests", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id").references(() => employees.id).notNull(),
  tenantId: integer("tenant_id").references(() => tenants.id).notNull(),
  leaveType: leaveTypeEnum("leave_type").notNull(),
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  totalDays: integer("total_days").notNull(),
  notes: text("notes"),
  status: timeOffStatusEnum("status").default("pending").notNull(),
  reviewedByUserId: varchar("reviewed_by_user_id").references(() => users.id),
  reviewedAt: timestamp("reviewed_at"),
  reviewNote: text("review_note"),
  requestedByUserId: varchar("requested_by_user_id").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_time_off_tenant_id").on(table.tenantId),
  index("idx_time_off_employee_id").on(table.employeeId),
  index("idx_time_off_tenant_status").on(table.tenantId, table.status),
  index("idx_time_off_employee_dates").on(table.employeeId, table.startDate, table.endDate),
]);

export const insertTimeOffRequestSchema = createInsertSchema(timeOffRequests).omit({ id: true, createdAt: true, updatedAt: true });
export type TimeOffRequest = typeof timeOffRequests.$inferSelect;
export type InsertTimeOffRequest = z.infer<typeof insertTimeOffRequestSchema>;

export const controllerActivityLog = pgTable("controller_activity_log", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenants.id).notNull(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  actionType: text("action_type").notNull(),
  shiftId: integer("shift_id").references(() => shifts.id),
  incidentId: integer("incident_id").references(() => incidents.id),
  details: text("details"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_controller_activity_tenant").on(table.tenantId),
  index("idx_controller_activity_tenant_date").on(table.tenantId, table.createdAt),
]);

export const insertControllerActivityLogSchema = createInsertSchema(controllerActivityLog).omit({ id: true, createdAt: true });
export type ControllerActivityLog = typeof controllerActivityLog.$inferSelect;
export type InsertControllerActivityLog = z.infer<typeof insertControllerActivityLogSchema>;

export const invoiceNumberAuditLog = pgTable("invoice_number_audit_log", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenants.id),
  invoiceId: integer("invoice_id").references(() => invoices.id).notNull(),
  oldNumber: text("old_number").notNull(),
  newNumber: text("new_number").notNull(),
  series: text("series").notNull(),
  reason: text("reason"),
  changedAt: timestamp("changed_at").defaultNow(),
}, (table) => [
  index("idx_inv_num_audit_invoice").on(table.invoiceId),
  index("idx_inv_num_audit_series").on(table.series),
  index("idx_inv_num_audit_old").on(table.oldNumber),
  index("idx_inv_num_audit_tenant").on(table.tenantId),
]);

export const insertInvoiceNumberAuditLogSchema = createInsertSchema(invoiceNumberAuditLog).omit({ id: true, changedAt: true });
export type InvoiceNumberAuditLog = typeof invoiceNumberAuditLog.$inferSelect;
export type InsertInvoiceNumberAuditLog = z.infer<typeof insertInvoiceNumberAuditLogSchema>;

export const employeeAvailability = pgTable("employee_availability", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id").references(() => employees.id).notNull(),
  tenantId: integer("tenant_id").references(() => tenants.id).notNull(),
  dayOfWeek: integer("day_of_week").notNull(),
  isAvailable: boolean("is_available").default(true).notNull(),
  startTime: text("start_time"),
  endTime: text("end_time"),
  notes: text("notes"),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_emp_avail_tenant").on(table.tenantId),
  index("idx_emp_avail_employee").on(table.employeeId),
  uniqueIndex("idx_emp_avail_employee_day").on(table.employeeId, table.dayOfWeek),
]);

export const insertEmployeeAvailabilitySchema = createInsertSchema(employeeAvailability).omit({ id: true, updatedAt: true });
export type EmployeeAvailability = typeof employeeAvailability.$inferSelect;
export type InsertEmployeeAvailability = z.infer<typeof insertEmployeeAvailabilitySchema>;

export const shiftTemplates = pgTable("shift_templates", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenants.id).notNull(),
  siteId: integer("site_id").references(() => sites.id),
  name: text("name").notNull(),
  description: text("description"),
  title: text("title").notNull(),
  startTime: text("start_time").notNull(),
  endTime: text("end_time").notNull(),
  daysOfWeek: integer("days_of_week").array().notNull(),
  siaLicenseType: text("sia_license_type"),
  requiredCount: integer("required_count").default(1).notNull(),
  notes: text("notes"),
  isActive: boolean("is_active").default(true).notNull(),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_shift_templates_tenant").on(table.tenantId),
  index("idx_shift_templates_site").on(table.siteId),
]);

export const insertShiftTemplateSchema = createInsertSchema(shiftTemplates).omit({ id: true, createdAt: true, updatedAt: true });
export type ShiftTemplate = typeof shiftTemplates.$inferSelect;
export type InsertShiftTemplate = z.infer<typeof insertShiftTemplateSchema>;

export const opsCheckItems = pgTable("ops_check_items", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenants.id).notNull(),
  label: text("label").notNull(),
  description: text("description"),
  sortOrder: integer("sort_order").default(0),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_ops_check_items_tenant").on(table.tenantId),
]);

export const insertOpsCheckItemSchema = createInsertSchema(opsCheckItems).omit({ id: true, createdAt: true });
export type OpsCheckItem = typeof opsCheckItems.$inferSelect;
export type InsertOpsCheckItem = z.infer<typeof insertOpsCheckItemSchema>;

export const opsChecks = pgTable("ops_checks", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenants.id).notNull(),
  employeeId: integer("employee_id").references(() => employees.id).notNull(),
  shiftId: integer("shift_id").references(() => shifts.id).notNull(),
  checklist: jsonb("checklist").$type<Array<{ itemId: number; label: string; checked: boolean }>>().notNull(),
  allPassed: boolean("all_passed").default(false),
  notes: text("notes"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_ops_checks_tenant").on(table.tenantId),
  index("idx_ops_checks_shift").on(table.shiftId),
  index("idx_ops_checks_employee").on(table.employeeId),
]);

export const insertOpsCheckSchema = createInsertSchema(opsChecks).omit({ id: true, createdAt: true });
export type OpsCheck = typeof opsChecks.$inferSelect;
export type InsertOpsCheck = z.infer<typeof insertOpsCheckSchema>;

export const aiLearningDomainEnum = pgEnum("ai_learning_domain", [
  "scheduling", "email_classification", "email_action"
]);

export const aiLearningEvents = pgTable("ai_learning_events", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull(),
  userId: varchar("user_id", { length: 255 }).notNull(),
  domain: aiLearningDomainEnum("domain").notNull(),
  inputContext: jsonb("input_context"),
  aiProposal: jsonb("ai_proposal"),
  status: aiDecisionStatusEnum("status").default("suggested").notNull(),
  feedback: text("feedback"),
  operatorCorrection: text("operator_correction"),
  correctActionType: varchar("correct_action_type", { length: 100 }),
  correctActionParams: jsonb("correct_action_params"),
  batchId: varchar("batch_id", { length: 100 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  decidedAt: timestamp("decided_at"),
}, (table) => [
  index("idx_ai_learning_tenant_domain").on(table.tenantId, table.domain),
  index("idx_ai_learning_batch").on(table.batchId),
]);

export const insertAiLearningEventSchema = createInsertSchema(aiLearningEvents).omit({ id: true, createdAt: true });
export type AiLearningEvent = typeof aiLearningEvents.$inferSelect;
export type InsertAiLearningEvent = z.infer<typeof insertAiLearningEventSchema>;

export const emailProcessingStatusEnum = pgEnum("email_processing_status", [
  "unread", "classified", "action_proposed", "action_taken", "completed", "ignored"
]);

export const inboxEmails = pgTable("inbox_emails", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull(),
  outlookMessageId: varchar("outlook_message_id", { length: 500 }).notNull(),
  fromAddress: varchar("from_address", { length: 500 }).notNull(),
  fromName: varchar("from_name", { length: 255 }),
  subject: varchar("subject", { length: 1000 }),
  bodyPreview: text("body_preview"),
  bodyText: text("body_text"),
  receivedAt: timestamp("received_at").notNull(),
  processingStatus: emailProcessingStatusEnum("processing_status").default("unread").notNull(),
  aiSummary: text("ai_summary"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_inbox_emails_tenant").on(table.tenantId),
  index("idx_inbox_emails_outlook_id").on(table.outlookMessageId),
]);

export const insertInboxEmailSchema = createInsertSchema(inboxEmails).omit({ id: true, createdAt: true });
export type InboxEmail = typeof inboxEmails.$inferSelect;
export type InsertInboxEmail = z.infer<typeof insertInboxEmailSchema>;

export const emailCategoryEnum = pgEnum("email_category", [
  "new_shift", "cancellation", "lateness", "blowout", "new_client",
  "site_change", "officer_replacement", "schedule_change", "general_enquiry"
]);

export const emailClassifications = pgTable("email_classifications", {
  id: serial("id").primaryKey(),
  emailId: integer("email_id").references(() => inboxEmails.id).notNull(),
  tenantId: integer("tenant_id").notNull(),
  category: emailCategoryEnum("category").notNull(),
  confidence: integer("confidence").default(0),
  extractedEntities: jsonb("extracted_entities"),
  reasoning: text("reasoning"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_email_class_email").on(table.emailId),
  index("idx_email_class_tenant").on(table.tenantId),
]);

export const insertEmailClassificationSchema = createInsertSchema(emailClassifications).omit({ id: true, createdAt: true });
export type EmailClassification = typeof emailClassifications.$inferSelect;
export type InsertEmailClassification = z.infer<typeof insertEmailClassificationSchema>;

export const proposedActionStatusEnum = pgEnum("proposed_action_status", [
  "pending", "approved", "rejected", "executed", "failed"
]);

export const proposedActions = pgTable("proposed_actions", {
  id: serial("id").primaryKey(),
  emailId: integer("email_id").references(() => inboxEmails.id).notNull(),
  tenantId: integer("tenant_id").notNull(),
  actionType: varchar("action_type", { length: 100 }).notNull(),
  actionLabel: varchar("action_label", { length: 500 }).notNull(),
  actionParams: jsonb("action_params"),
  status: proposedActionStatusEnum("status").default("pending").notNull(),
  autoApproved: boolean("auto_approved").default(false),
  decidedBy: varchar("decided_by", { length: 255 }),
  rejectionReason: text("rejection_reason"),
  executionResult: jsonb("execution_result"),
  learningEventId: integer("learning_event_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  decidedAt: timestamp("decided_at"),
}, (table) => [
  index("idx_proposed_actions_email").on(table.emailId),
  index("idx_proposed_actions_tenant").on(table.tenantId),
  index("idx_proposed_actions_status").on(table.status),
]);

export const insertProposedActionSchema = createInsertSchema(proposedActions).omit({ id: true, createdAt: true });
export type ProposedAction = typeof proposedActions.$inferSelect;
export type InsertProposedAction = z.infer<typeof insertProposedActionSchema>;

export const emailAutoApproveSettings = pgTable("email_auto_approve_settings", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull(),
  actionType: varchar("action_type", { length: 100 }).notNull(),
  enabled: boolean("enabled").default(false).notNull(),
  updatedBy: varchar("updated_by", { length: 255 }),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_auto_approve_tenant").on(table.tenantId),
]);

export const insertEmailAutoApproveSettingSchema = createInsertSchema(emailAutoApproveSettings).omit({ id: true });
export type EmailAutoApproveSetting = typeof emailAutoApproveSettings.$inferSelect;
export type InsertEmailAutoApproveSetting = z.infer<typeof insertEmailAutoApproveSettingSchema>;

export const tenantEmailConnections = pgTable("tenant_email_connections", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().unique(),
  provider: varchar("provider", { length: 50 }).default("outlook").notNull(),
  clientId: text("client_id").notNull(),
  clientSecret: text("client_secret").notNull(),
  azureTenantId: text("azure_tenant_id").notNull(),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  tokenExpiresAt: timestamp("token_expires_at"),
  pollingEnabled: boolean("polling_enabled").default(false).notNull(),
  pollingIntervalMinutes: integer("polling_interval_minutes").default(2).notNull(),
  connectedEmail: varchar("connected_email", { length: 255 }),
  connectionStatus: varchar("connection_status", { length: 50 }).default("disconnected").notNull(),
  lastPolledAt: timestamp("last_polled_at"),
  lastError: text("last_error"),
  connectedBy: varchar("connected_by", { length: 255 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_email_conn_tenant").on(table.tenantId),
]);

export const insertTenantEmailConnectionSchema = createInsertSchema(tenantEmailConnections).omit({ id: true, createdAt: true, updatedAt: true });
export type TenantEmailConnection = typeof tenantEmailConnections.$inferSelect;
export type InsertTenantEmailConnection = z.infer<typeof insertTenantEmailConnectionSchema>;

export const tenantEmailSettings = pgTable("tenant_email_settings", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().unique().references(() => tenants.id, { onDelete: "cascade" }),
  enabled: boolean("enabled").default(false).notNull(),
  provider: text("provider").default("smtp").notNull(),
  fromName: text("from_name"),
  fromEmail: text("from_email"),
  replyToEmail: text("reply_to_email"),
  smtpHost: text("smtp_host"),
  smtpPort: integer("smtp_port").default(587),
  smtpSecure: boolean("smtp_secure").default(false).notNull(),
  smtpUser: text("smtp_user"),
  smtpPasswordEncrypted: text("smtp_password_encrypted"),
  resendApiKeyEncrypted: text("resend_api_key_encrypted"),
  lastTestedAt: timestamp("last_tested_at"),
  lastTestStatus: text("last_test_status"),
  lastError: text("last_error"),
  updatedBy: varchar("updated_by", { length: 255 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_tenant_email_settings_tenant").on(table.tenantId),
]);

export const insertTenantEmailSettingsSchema = createInsertSchema(tenantEmailSettings).omit({ id: true, createdAt: true, updatedAt: true });
export type TenantEmailSettings = typeof tenantEmailSettings.$inferSelect;
export type InsertTenantEmailSettings = z.infer<typeof insertTenantEmailSettingsSchema>;

export const tenantOfficerTypes = pgTable("tenant_officer_types", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  sortOrder: integer("sort_order").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("uq_tenant_officer_types_tenant_name").on(table.tenantId, table.name),
  index("idx_tenant_officer_types_tenant").on(table.tenantId),
]);

export const insertTenantOfficerTypeSchema = createInsertSchema(tenantOfficerTypes).omit({ id: true, createdAt: true });
export type TenantOfficerType = typeof tenantOfficerTypes.$inferSelect;
export type InsertTenantOfficerType = z.infer<typeof insertTenantOfficerTypeSchema>;

export const tenantXeroConnections = pgTable("tenant_xero_connections", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().unique(),
  clientId: text("client_id").notNull(),
  clientSecret: text("client_secret").notNull(),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  tokenExpiresAt: timestamp("token_expires_at"),
  xeroTenantId: text("xero_tenant_id"),
  xeroTenantName: text("xero_tenant_name"),
  connectionStatus: varchar("connection_status", { length: 50 }).default("disconnected").notNull(),
  syncEnabled: boolean("sync_enabled").default(false).notNull(),
  syncIntervalMinutes: integer("sync_interval_minutes").default(60).notNull(),
  lastSyncedAt: timestamp("last_synced_at"),
  lastError: text("last_error"),
  oauthState: text("oauth_state"),
  connectedBy: varchar("connected_by", { length: 255 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_xero_conn_tenant").on(table.tenantId),
]);

export const insertTenantXeroConnectionSchema = createInsertSchema(tenantXeroConnections).omit({ id: true, createdAt: true, updatedAt: true });
export type TenantXeroConnection = typeof tenantXeroConnections.$inferSelect;
export type InsertTenantXeroConnection = z.infer<typeof insertTenantXeroConnectionSchema>;

export const xeroSyncRecords = pgTable("xero_sync_records", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenants.id).notNull(),
  entityType: text("entity_type").notNull(),
  entityId: integer("entity_id").notNull(),
  xeroId: text("xero_id"),
  syncStatus: text("sync_status").notNull().default("pending"),
  lastSyncedAt: timestamp("last_synced_at"),
  lastError: text("last_error"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_xero_sync_tenant").on(table.tenantId),
  index("idx_xero_sync_tenant_type").on(table.tenantId, table.entityType),
  uniqueIndex("uq_xero_sync_tenant_entity").on(table.tenantId, table.entityType, table.entityId),
]);

export const insertXeroSyncRecordSchema = createInsertSchema(xeroSyncRecords).omit({ id: true, createdAt: true, updatedAt: true });
export type XeroSyncRecord = typeof xeroSyncRecords.$inferSelect;
export type InsertXeroSyncRecord = z.infer<typeof insertXeroSyncRecordSchema>;

export const employeeImmigration = pgTable("employee_immigration", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id").references(() => employees.id).notNull(),
  tenantId: integer("tenant_id").references(() => tenants.id),
  passportDocNo: text("passport_doc_no"),
  passportCountry: text("passport_country"),
  passportIssueDate: date("passport_issue_date"),
  passportExpiryDate: date("passport_expiry_date"),
  visaNeeded: boolean("visa_needed").default(false),
  visaType: text("visa_type"),
  visaIssueDate: date("visa_issue_date"),
  visaExpiryDate: date("visa_expiry_date"),
  visaDateOfEntry: date("visa_date_of_entry"),
  shareCode: text("share_code"),
  shareCodeExpiry: date("share_code_expiry"),
  brpNeeded: boolean("brp_needed").default(false),
  brpNumber: text("brp_number"),
  brpExpiry: date("brp_expiry"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  uniqueIndex("uq_employee_immigration_employee").on(table.employeeId),
  index("idx_employee_immigration_tenant").on(table.tenantId),
]);

export const insertEmployeeImmigrationSchema = createInsertSchema(employeeImmigration).omit({ id: true, createdAt: true, updatedAt: true });
export type EmployeeImmigration = typeof employeeImmigration.$inferSelect;
export type InsertEmployeeImmigration = z.infer<typeof insertEmployeeImmigrationSchema>;

export const leaveEntitlements = pgTable("leave_entitlements", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id").references(() => employees.id).notNull(),
  tenantId: integer("tenant_id").references(() => tenants.id).notNull(),
  year: integer("year").notNull(),
  entitlementDays: integer("entitlement_days").notNull().default(28),
  carriedForward: integer("carried_forward").notNull().default(0),
  adjustmentDays: integer("adjustment_days").notNull().default(0),
  adjustmentReason: text("adjustment_reason"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  uniqueIndex("uq_leave_entitlement_employee_year").on(table.employeeId, table.year),
  index("idx_leave_entitlements_tenant").on(table.tenantId),
  index("idx_leave_entitlements_employee").on(table.employeeId),
]);

export const insertLeaveEntitlementSchema = createInsertSchema(leaveEntitlements).omit({ id: true, createdAt: true });
export type LeaveEntitlement = typeof leaveEntitlements.$inferSelect;
export type InsertLeaveEntitlement = z.infer<typeof insertLeaveEntitlementSchema>;

export const probationStatusEnum = pgEnum("probation_status", [
  "active", "passed", "extended", "failed"
]);

export const probationRecords = pgTable("probation_records", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id").references(() => employees.id).notNull(),
  tenantId: integer("tenant_id").references(() => tenants.id).notNull(),
  startDate: date("start_date").notNull(),
  reviewDate: date("review_date").notNull(),
  extendedReviewDate: date("extended_review_date"),
  status: probationStatusEnum("status").default("active").notNull(),
  outcomeNotes: text("outcome_notes"),
  reviewedBy: varchar("reviewed_by").references(() => users.id),
  reviewedAt: timestamp("reviewed_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_probation_tenant_id").on(table.tenantId),
  index("idx_probation_employee_id").on(table.employeeId),
  index("idx_probation_tenant_status").on(table.tenantId, table.status),
  index("idx_probation_review_date").on(table.tenantId, table.reviewDate),
]);

export const insertProbationRecordSchema = createInsertSchema(probationRecords).omit({ id: true, createdAt: true, updatedAt: true });
export type ProbationRecord = typeof probationRecords.$inferSelect;
export type InsertProbationRecord = z.infer<typeof insertProbationRecordSchema>;

export const hrCaseTypeEnum = pgEnum("hr_case_type", [
  "disciplinary", "grievance", "capability", "appeal"
]);

export const hrCaseStatusEnum = pgEnum("hr_case_status", [
  "open", "investigation", "hearing_scheduled", "outcome_given", "appealed", "closed"
]);

export const hrCaseOutcomeEnum = pgEnum("hr_case_outcome", [
  "no_action", "verbal_warning", "written_warning", "final_warning", "dismissal", "upheld", "not_upheld"
]);

export const hrCases = pgTable("hr_cases", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenants.id).notNull(),
  employeeId: integer("employee_id").references(() => employees.id).notNull(),
  caseType: hrCaseTypeEnum("case_type").notNull(),
  status: hrCaseStatusEnum("status").default("open").notNull(),
  openedBy: varchar("opened_by").references(() => users.id).notNull(),
  assignedTo: varchar("assigned_to").references(() => users.id),
  incidentDate: date("incident_date"),
  allegationSummary: text("allegation_summary"),
  hearingDate: timestamp("hearing_date"),
  outcome: hrCaseOutcomeEnum("outcome"),
  outcomeDate: date("outcome_date"),
  outcomeNotes: text("outcome_notes"),
  appealDeadline: date("appeal_deadline"),
  closedAt: timestamp("closed_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_hr_cases_tenant").on(table.tenantId),
  index("idx_hr_cases_employee").on(table.employeeId),
  index("idx_hr_cases_tenant_status").on(table.tenantId, table.status),
]);

export const insertHrCaseSchema = createInsertSchema(hrCases).omit({ id: true, createdAt: true, updatedAt: true });
export type HrCase = typeof hrCases.$inferSelect;
export type InsertHrCase = z.infer<typeof insertHrCaseSchema>;

export const hrCaseEvents = pgTable("hr_case_events", {
  id: serial("id").primaryKey(),
  caseId: integer("case_id").references(() => hrCases.id).notNull(),
  tenantId: integer("tenant_id").references(() => tenants.id).notNull(),
  eventType: text("event_type").notNull(),
  notes: text("notes"),
  createdBy: varchar("created_by").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_hr_case_events_case").on(table.caseId),
]);

export const insertHrCaseEventSchema = createInsertSchema(hrCaseEvents).omit({ id: true, createdAt: true });
export type HrCaseEvent = typeof hrCaseEvents.$inferSelect;
export type InsertHrCaseEvent = z.infer<typeof insertHrCaseEventSchema>;

export const hrCaseDocuments = pgTable("hr_case_documents", {
  id: serial("id").primaryKey(),
  caseId: integer("case_id").references(() => hrCases.id).notNull(),
  tenantId: integer("tenant_id").references(() => tenants.id).notNull(),
  fileName: text("file_name").notNull(),
  fileUrl: text("file_url").notNull(),
  fileSize: integer("file_size"),
  mimeType: text("mime_type"),
  documentType: text("document_type").default("evidence"),
  uploadedBy: varchar("uploaded_by").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_hr_case_documents_case").on(table.caseId),
]);

export const insertHrCaseDocumentSchema = createInsertSchema(hrCaseDocuments).omit({ id: true, createdAt: true });
export type HrCaseDocument = typeof hrCaseDocuments.$inferSelect;
export type InsertHrCaseDocument = z.infer<typeof insertHrCaseDocumentSchema>;
export const absenceTypeEnum = pgEnum("absence_type", [
  "sickness", "unauthorised", "compassionate", "paternity", "maternity", "jury_duty", "other"
]);

export const absenceStatusEnum = pgEnum("absence_status", [
  "open", "closed"
]);

export const absenceRecords = pgTable("absence_records", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id").references(() => employees.id).notNull(),
  tenantId: integer("tenant_id").references(() => tenants.id).notNull(),
  absenceType: absenceTypeEnum("absence_type").notNull(),
  startDate: date("start_date").notNull(),
  endDate: date("end_date"),
  totalDays: integer("total_days"),
  reason: text("reason"),
  selfCertified: boolean("self_certified").default(false),
  fitNoteUrl: text("fit_note_url"),
  returnToWorkConducted: boolean("return_to_work_conducted").default(false),
  returnToWorkDate: date("return_to_work_date"),
  returnToWorkNotes: text("return_to_work_notes"),
  reviewedBy: varchar("reviewed_by").references(() => users.id),
  status: absenceStatusEnum("status").default("open"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_absence_records_tenant_id").on(table.tenantId),
  index("idx_absence_records_employee_id").on(table.employeeId),
  index("idx_absence_records_tenant_employee").on(table.tenantId, table.employeeId),
  index("idx_absence_records_start_date").on(table.tenantId, table.startDate),
]);

export const insertAbsenceRecordSchema = createInsertSchema(absenceRecords).omit({ id: true, createdAt: true, updatedAt: true });
export type AbsenceRecord = typeof absenceRecords.$inferSelect;
export type InsertAbsenceRecord = z.infer<typeof insertAbsenceRecordSchema>;

export const trainingTypeEnum = pgEnum("training_type", [
  "first_aid", "manual_handling", "fire_marshal", "conflict_resolution", "sia_refresher", "custom"
]);

export const trainingStatusEnum = pgEnum("training_status", [
  "not_started", "in_progress", "completed", "expired"
]);

export const trainingRecords = pgTable("training_records", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id").references(() => employees.id).notNull(),
  tenantId: integer("tenant_id").references(() => tenants.id).notNull(),
  trainingType: trainingTypeEnum("training_type").notNull().default("custom"),
  trainingName: text("training_name").notNull(),
  provider: text("provider"),
  completedDate: date("completed_date"),
  expiryDate: date("expiry_date"),
  certificateUrl: text("certificate_url"),
  status: trainingStatusEnum("status").notNull().default("not_started"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_training_records_tenant").on(table.tenantId),
  index("idx_training_records_employee").on(table.employeeId),
  index("idx_training_records_tenant_employee").on(table.tenantId, table.employeeId),
]);

export const insertTrainingRecordSchema = createInsertSchema(trainingRecords).omit({ id: true, createdAt: true, updatedAt: true });
export type TrainingRecord = typeof trainingRecords.$inferSelect;
export type InsertTrainingRecord = z.infer<typeof insertTrainingRecordSchema>;

export const manualPurchases = pgTable("manual_purchases", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenants.id).notNull(),
  purchaseDate: date("purchase_date").notNull(),
  vendorName: text("vendor_name").notNull(),
  vendorVatNumber: text("vendor_vat_number"),
  description: text("description").notNull(),
  netAmount: numeric("net_amount", { precision: 12, scale: 2 }).notNull(),
  vatRate: numeric("vat_rate", { precision: 5, scale: 2 }).default("20").notNull(),
  vatAmount: numeric("vat_amount", { precision: 12, scale: 2 }).notNull(),
  grossAmount: numeric("gross_amount", { precision: 12, scale: 2 }).notNull(),
  expenseCategory: text("expense_category"),
  vatStatus: text("vat_status").default("standard"),
  paymentStatus: text("payment_status").default("unpaid"),
  bankReference: text("bank_reference"),
  receiptUrl: text("receipt_url"),
  notes: text("notes"),
  duplicateOfBankTransactionId: integer("duplicate_of_bank_transaction_id"),
  importHash: text("import_hash"),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_manual_purchases_tenant").on(table.tenantId),
  index("idx_manual_purchases_tenant_date").on(table.tenantId, table.purchaseDate),
  index("idx_manual_purchases_import_hash").on(table.tenantId, table.importHash),
]);

export const insertManualPurchaseSchema = createInsertSchema(manualPurchases).omit({ id: true, createdAt: true, updatedAt: true });
export type ManualPurchase = typeof manualPurchases.$inferSelect;
export type InsertManualPurchase = z.infer<typeof insertManualPurchaseSchema>;

export const wagesLedger = pgTable("wages_ledger", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenants.id).notNull(),
  entryDate: date("entry_date").notNull(),
  description: text("description"),
  grossAmount: numeric("gross_amount", { precision: 12, scale: 2 }).notNull(),
  vatQuarter: text("vat_quarter"),
  notes: text("notes"),
  importHash: text("import_hash"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_wages_ledger_tenant").on(table.tenantId),
  index("idx_wages_ledger_tenant_date").on(table.tenantId, table.entryDate),
  index("idx_wages_ledger_import_hash").on(table.tenantId, table.importHash),
]);

export const insertWagesLedgerSchema = createInsertSchema(wagesLedger).omit({ id: true, createdAt: true });
export type WagesLedgerEntry = typeof wagesLedger.$inferSelect;
export type InsertWagesLedgerEntry = z.infer<typeof insertWagesLedgerSchema>;
