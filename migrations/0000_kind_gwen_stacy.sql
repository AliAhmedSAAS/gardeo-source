CREATE TYPE "public"."application_status" AS ENUM('applied', 'screening', 'interview', 'offer', 'hired', 'rejected', 'withdrawn');--> statement-breakpoint
CREATE TYPE "public"."incident_severity" AS ENUM('low', 'medium', 'high', 'critical');--> statement-breakpoint
CREATE TYPE "public"."incident_status" AS ENUM('reported', 'investigating', 'resolved', 'closed');--> statement-breakpoint
CREATE TYPE "public"."invoice_status" AS ENUM('draft', 'pending', 'approved', 'paid', 'overdue', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."onboarding_status" AS ENUM('invited', 'in_progress', 'submitted', 'under_review', 'approved', 'rejected', 'completed');--> statement-breakpoint
CREATE TYPE "public"."shift_status" AS ENUM('scheduled', 'in_progress', 'completed', 'cancelled', 'no_show');--> statement-breakpoint
CREATE TYPE "public"."supplier_document_type" AS ENUM('companies_house_proof', 'bank_proof', 'supplier_declaration', 'vat_evidence', 'sample_vat_invoice', 'non_vat_declaration', 'el_insurance', 'pl_insurance', 'rtw_payroll_statement', 'labour_supply_chain_statement');--> statement-breakpoint
CREATE TYPE "public"."supplier_pending_change_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."supplier_status" AS ENUM('draft', 'pending', 'submitted', 'approved', 'info_required', 'active', 'suspended', 'terminated');--> statement-breakpoint
CREATE TYPE "public"."supplier_type" AS ENUM('labour', 'non_labour');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('super_admin', 'tenant_admin', 'controller', 'hr_manager', 'accountant', 'supplier', 'employee');--> statement-breakpoint
CREATE TYPE "public"."vetting_status" AS ENUM('not_started', 'pending', 'in_progress', 'passed', 'failed', 'expired');--> statement-breakpoint
CREATE TABLE "applicants" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer,
	"job_posting_id" integer,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text,
	"cv_url" text,
	"cover_letter" text,
	"status" "application_status" DEFAULT 'applied',
	"interview_date" timestamp,
	"interview_notes" text,
	"rating" integer,
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer,
	"user_id" varchar,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text,
	"details" jsonb,
	"ip_address" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "bank_details" (
	"id" serial PRIMARY KEY NOT NULL,
	"employee_id" integer,
	"account_name" text NOT NULL,
	"bank_name" text NOT NULL,
	"sort_code" text NOT NULL,
	"account_number" text NOT NULL,
	"building_society_ref" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" serial PRIMARY KEY NOT NULL,
	"employee_id" integer,
	"tenant_id" integer,
	"document_type" text NOT NULL,
	"file_name" text NOT NULL,
	"file_url" text NOT NULL,
	"file_size" integer,
	"mime_type" text,
	"expiry_date" date,
	"is_verified" boolean DEFAULT false,
	"verified_by" varchar,
	"verified_at" timestamp,
	"notes" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "emergency_contacts" (
	"id" serial PRIMARY KEY NOT NULL,
	"employee_id" integer,
	"name" text NOT NULL,
	"relationship" text NOT NULL,
	"phone" text NOT NULL,
	"alternate_phone" text,
	"email" text,
	"address" text,
	"is_primary" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "employees" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar,
	"tenant_id" integer,
	"employee_number" text,
	"date_of_birth" date,
	"national_insurance" text,
	"gender" text,
	"nationality" text,
	"address_line_1" text,
	"address_line_2" text,
	"city" text,
	"county" text,
	"postcode" text,
	"country" text DEFAULT 'United Kingdom',
	"start_date" date,
	"job_title" text,
	"department" text,
	"employment_type" text,
	"hourly_rate" text,
	"uniform_size" text,
	"boot_size" text,
	"equipment_notes" text,
	"sia_license_number" text,
	"sia_license_type" text,
	"sia_expiry_date" date,
	"dbs_certificate_number" text,
	"dbs_issue_date" date,
	"has_first_aid" boolean DEFAULT false,
	"first_aid_expiry" date,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "employment_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"employee_id" integer,
	"employer_name" text NOT NULL,
	"job_title" text NOT NULL,
	"date_from" date NOT NULL,
	"date_to" date,
	"is_current" boolean DEFAULT false,
	"reason_for_leaving" text,
	"duties" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "incidents" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer,
	"site_id" integer,
	"reported_by" varchar,
	"assigned_to" varchar,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"severity" "incident_severity" DEFAULT 'medium',
	"status" "incident_status" DEFAULT 'reported',
	"incident_date" timestamp DEFAULT now(),
	"resolved_at" timestamp,
	"resolution" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer,
	"supplier_id" integer,
	"employee_id" integer,
	"invoice_number" text NOT NULL,
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"total_hours" text,
	"hourly_rate" text,
	"subtotal" text NOT NULL,
	"vat_rate" text DEFAULT '20',
	"vat_amount" text NOT NULL,
	"total_amount" text NOT NULL,
	"status" "invoice_status" DEFAULT 'draft',
	"due_date" date,
	"paid_at" timestamp,
	"notes" text,
	"created_by" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "job_postings" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer,
	"title" text NOT NULL,
	"department" text,
	"location" text,
	"employment_type" text,
	"description" text NOT NULL,
	"requirements" text,
	"hourly_rate" text,
	"site_id" integer,
	"is_active" boolean DEFAULT true,
	"closing_date" date,
	"created_by" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "onboarding_records" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar,
	"tenant_id" integer,
	"status" "onboarding_status" DEFAULT 'invited',
	"current_step" integer DEFAULT 1,
	"total_steps" integer DEFAULT 10,
	"personal_details_complete" boolean DEFAULT false,
	"contact_details_complete" boolean DEFAULT false,
	"emergency_contact_complete" boolean DEFAULT false,
	"bank_details_complete" boolean DEFAULT false,
	"documents_complete" boolean DEFAULT false,
	"vetting_complete" boolean DEFAULT false,
	"uniform_complete" boolean DEFAULT false,
	"terms_accepted" boolean DEFAULT false,
	"terms_accepted_at" timestamp,
	"submitted_at" timestamp,
	"reviewed_by" varchar,
	"reviewed_at" timestamp,
	"review_notes" text,
	"completed_at" timestamp,
	"invite_token" text,
	"invite_expires_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "password_reset_tokens" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "password_reset_tokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "references" (
	"id" serial PRIMARY KEY NOT NULL,
	"employee_id" integer,
	"referee_name" text NOT NULL,
	"referee_email" text,
	"referee_phone" text,
	"company" text NOT NULL,
	"job_title" text,
	"relationship" text,
	"date_from" date,
	"date_to" date,
	"status" "vetting_status" DEFAULT 'not_started',
	"response_received" boolean DEFAULT false,
	"response_date" timestamp,
	"notes" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"sid" varchar PRIMARY KEY NOT NULL,
	"sess" jsonb NOT NULL,
	"expire" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shifts" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer,
	"site_id" integer,
	"employee_id" integer,
	"title" text NOT NULL,
	"date" date NOT NULL,
	"start_time" text NOT NULL,
	"end_time" text NOT NULL,
	"break_minutes" integer DEFAULT 0,
	"status" "shift_status" DEFAULT 'scheduled',
	"notes" text,
	"check_in_time" timestamp,
	"check_out_time" timestamp,
	"created_by" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "sites" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer,
	"name" text NOT NULL,
	"address" text NOT NULL,
	"city" text,
	"postcode" text,
	"latitude" text,
	"longitude" text,
	"client_name" text,
	"client_contact" text,
	"client_email" text,
	"client_phone" text,
	"contract_ref" text,
	"is_active" boolean DEFAULT true,
	"notes" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "supplier_documents" (
	"id" serial PRIMARY KEY NOT NULL,
	"supplier_id" integer NOT NULL,
	"document_type" "supplier_document_type" NOT NULL,
	"file_name" text NOT NULL,
	"file_url" text NOT NULL,
	"file_size" integer,
	"mime_type" text,
	"version" integer DEFAULT 1,
	"uploaded_by" varchar,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "supplier_invitations" (
	"id" serial PRIMARY KEY NOT NULL,
	"supplier_id" integer NOT NULL,
	"email" text NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"accepted_at" timestamp,
	"reminder_sent_at" timestamp,
	"created_by" varchar,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "supplier_invitations_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "supplier_login_activity" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"supplier_id" integer NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"location" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "supplier_pending_changes" (
	"id" serial PRIMARY KEY NOT NULL,
	"supplier_id" integer NOT NULL,
	"user_id" varchar NOT NULL,
	"payload" jsonb NOT NULL,
	"status" "supplier_pending_change_status" DEFAULT 'pending',
	"reviewed_by" varchar,
	"reviewed_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "suppliers" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer,
	"company_name" text NOT NULL,
	"contact_name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text,
	"address" text,
	"city" text,
	"postcode" text,
	"supplier_type" "supplier_type",
	"registered_office_address" text,
	"registered_office_city" text,
	"registered_office_postcode" text,
	"trading_same_as_registered" boolean DEFAULT true,
	"trading_address" text,
	"trading_city" text,
	"trading_postcode" text,
	"finance_contact_name" text,
	"finance_contact_email" text,
	"nature_of_supply" text,
	"vat_number" text,
	"vat_status" text,
	"non_vat_reason" text,
	"non_vat_declaration_accepted" boolean DEFAULT false,
	"company_reg_number" text,
	"bank_name" text,
	"account_name" text,
	"sort_code" text,
	"account_number" text,
	"status" "supplier_status" DEFAULT 'draft',
	"approved_by" varchar,
	"approved_at" timestamp,
	"submitted_at" timestamp,
	"submitted_by" varchar,
	"info_required_notes" text,
	"info_required_at" timestamp,
	"info_required_by" varchar,
	"suspension_reason" text,
	"suspended_at" timestamp,
	"suspended_by" varchar,
	"notes" text,
	"portal_access_enabled" boolean DEFAULT false,
	"portal_email" text,
	"user_id" varchar,
	"created_by" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"who_employs_workers" text,
	"umbrella_name" text,
	"umbrella_crn" text,
	"subcontractor_name" text,
	"subcontractor_crn" text,
	"subcontracting_yes" boolean DEFAULT false,
	"paye_compliance" boolean DEFAULT false,
	"rtw_compliance" boolean DEFAULT false,
	"nmw_compliance" boolean DEFAULT false
);
--> statement-breakpoint
CREATE TABLE "tenants" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"industry" text DEFAULT 'security',
	"address" text,
	"phone" text,
	"email" text,
	"vat_number" text,
	"company_reg_number" text,
	"logo_url" text,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "tenants_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" integer,
	"username" text NOT NULL,
	"email" text NOT NULL,
	"password" text NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"role" "user_role" DEFAULT 'employee' NOT NULL,
	"phone" text,
	"profile_image_url" text,
	"is_active" boolean DEFAULT true,
	"last_login_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "users_username_unique" UNIQUE("username"),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "vetting_records" (
	"id" serial PRIMARY KEY NOT NULL,
	"employee_id" integer,
	"tenant_id" integer,
	"check_type" text NOT NULL,
	"status" "vetting_status" DEFAULT 'not_started',
	"reference_number" text,
	"requested_date" date,
	"completed_date" date,
	"expiry_date" date,
	"result" text,
	"notes" text,
	"conducted_by" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "applicants" ADD CONSTRAINT "applicants_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "applicants" ADD CONSTRAINT "applicants_job_posting_id_job_postings_id_fk" FOREIGN KEY ("job_posting_id") REFERENCES "public"."job_postings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_details" ADD CONSTRAINT "bank_details_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_verified_by_users_id_fk" FOREIGN KEY ("verified_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "emergency_contacts" ADD CONSTRAINT "emergency_contacts_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employees" ADD CONSTRAINT "employees_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employees" ADD CONSTRAINT "employees_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employment_history" ADD CONSTRAINT "employment_history_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_reported_by_users_id_fk" FOREIGN KEY ("reported_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_postings" ADD CONSTRAINT "job_postings_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_postings" ADD CONSTRAINT "job_postings_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_postings" ADD CONSTRAINT "job_postings_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "onboarding_records" ADD CONSTRAINT "onboarding_records_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "onboarding_records" ADD CONSTRAINT "onboarding_records_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "onboarding_records" ADD CONSTRAINT "onboarding_records_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "references" ADD CONSTRAINT "references_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sites" ADD CONSTRAINT "sites_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_documents" ADD CONSTRAINT "supplier_documents_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_documents" ADD CONSTRAINT "supplier_documents_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_invitations" ADD CONSTRAINT "supplier_invitations_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_invitations" ADD CONSTRAINT "supplier_invitations_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_login_activity" ADD CONSTRAINT "supplier_login_activity_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_login_activity" ADD CONSTRAINT "supplier_login_activity_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_pending_changes" ADD CONSTRAINT "supplier_pending_changes_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_pending_changes" ADD CONSTRAINT "supplier_pending_changes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_pending_changes" ADD CONSTRAINT "supplier_pending_changes_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_submitted_by_users_id_fk" FOREIGN KEY ("submitted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_info_required_by_users_id_fk" FOREIGN KEY ("info_required_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_suspended_by_users_id_fk" FOREIGN KEY ("suspended_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vetting_records" ADD CONSTRAINT "vetting_records_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vetting_records" ADD CONSTRAINT "vetting_records_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vetting_records" ADD CONSTRAINT "vetting_records_conducted_by_users_id_fk" FOREIGN KEY ("conducted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "IDX_session_expire" ON "sessions" USING btree ("expire");