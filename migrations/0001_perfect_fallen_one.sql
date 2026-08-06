CREATE TYPE "public"."ai_decision_status" AS ENUM('suggested', 'accepted', 'rejected', 'modified');--> statement-breakpoint
CREATE TYPE "public"."channel_type" AS ENUM('team', 'site', 'direct', 'broadcast');--> statement-breakpoint
CREATE TYPE "public"."data_consent_status" AS ENUM('granted', 'withdrawn');--> statement-breakpoint
CREATE TYPE "public"."erasure_request_status" AS ENUM('pending', 'approved', 'rejected', 'completed');--> statement-breakpoint
CREATE TYPE "public"."subscription_plan" AS ENUM('starter', 'professional', 'enterprise');--> statement-breakpoint
CREATE TYPE "public"."supplier_document_audit_action" AS ENUM('uploaded', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."supplier_document_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."supplier_policy_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
ALTER TYPE "public"."supplier_document_type" ADD VALUE 'self_billing_agreement';--> statement-breakpoint
ALTER TYPE "public"."supplier_document_type" ADD VALUE 'other';--> statement-breakpoint
ALTER TYPE "public"."user_role" ADD VALUE 'ceo' BEFORE 'controller';--> statement-breakpoint
ALTER TYPE "public"."user_role" ADD VALUE 'operations_manager' BEFORE 'controller';--> statement-breakpoint
ALTER TYPE "public"."user_role" ADD VALUE 'regional_manager' BEFORE 'controller';--> statement-breakpoint
ALTER TYPE "public"."user_role" ADD VALUE 'admin' BEFORE 'controller';--> statement-breakpoint
ALTER TYPE "public"."user_role" ADD VALUE 'scheduler' BEFORE 'hr_manager';--> statement-breakpoint
ALTER TYPE "public"."user_role" ADD VALUE 'compliance_manager' BEFORE 'accountant';--> statement-breakpoint
ALTER TYPE "public"."user_role" ADD VALUE 'payroll_manager' BEFORE 'supplier';--> statement-breakpoint
ALTER TYPE "public"."user_role" ADD VALUE 'training_manager' BEFORE 'supplier';--> statement-breakpoint
CREATE TABLE "ai_decisions" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"site_id" integer,
	"site_name" varchar(255),
	"shift_date" varchar(50),
	"employee_id" integer,
	"employee_name" varchar(255),
	"suggested_shift_time" varchar(100),
	"reason" text,
	"priority" varchar(20),
	"status" "ai_decision_status" DEFAULT 'suggested' NOT NULL,
	"feedback" text,
	"requirements" text,
	"batch_id" varchar(100),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"decided_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "ai_insights" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer NOT NULL,
	"insight_type" varchar(50) NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text NOT NULL,
	"severity" varchar(20) DEFAULT 'info' NOT NULL,
	"data" jsonb,
	"is_active" boolean DEFAULT true NOT NULL,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "broadcast_reads" (
	"id" serial PRIMARY KEY NOT NULL,
	"broadcast_id" integer NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"read_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "broadcasts" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer NOT NULL,
	"sender_id" varchar(255) NOT NULL,
	"sender_name" varchar(255) NOT NULL,
	"title" varchar(255) NOT NULL,
	"content" text NOT NULL,
	"target_roles" text[],
	"priority" varchar(20) DEFAULT 'normal' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "channel_members" (
	"id" serial PRIMARY KEY NOT NULL,
	"channel_id" integer NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"joined_at" timestamp DEFAULT now() NOT NULL,
	"last_read_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "channels" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer NOT NULL,
	"name" varchar(255) NOT NULL,
	"type" "channel_type" NOT NULL,
	"description" text,
	"site_id" integer,
	"created_by" varchar(255) NOT NULL,
	"is_archived" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "data_consents" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"tenant_id" integer,
	"consent_type" text NOT NULL,
	"status" "data_consent_status" DEFAULT 'granted' NOT NULL,
	"granted_at" timestamp DEFAULT now(),
	"withdrawn_at" timestamp,
	"ip_address" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "data_erasure_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"tenant_id" integer,
	"reason" text,
	"status" "erasure_request_status" DEFAULT 'pending' NOT NULL,
	"reviewed_by" varchar,
	"reviewed_at" timestamp,
	"review_notes" text,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"channel_id" integer NOT NULL,
	"sender_id" varchar(255) NOT NULL,
	"sender_name" varchar(255) NOT NULL,
	"content" text NOT NULL,
	"is_edited" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"body" text,
	"link" text,
	"related_entity_type" text,
	"related_entity_id" text,
	"metadata" jsonb,
	"read_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "subscription_plans" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" "subscription_plan" NOT NULL,
	"price" text NOT NULL,
	"max_employees" integer NOT NULL,
	"max_sites" integer NOT NULL,
	"max_admin_users" integer NOT NULL,
	"features" jsonb DEFAULT '[]'::jsonb,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "subscription_plans_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "supplier_document_audit" (
	"id" serial PRIMARY KEY NOT NULL,
	"document_id" integer NOT NULL,
	"action" "supplier_document_audit_action" NOT NULL,
	"user_id" varchar,
	"details" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "supplier_field_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"supplier_id" integer NOT NULL,
	"field_key" text NOT NULL,
	"message" text,
	"requested_by" varchar NOT NULL,
	"requested_at" timestamp DEFAULT now(),
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "supplier_policies" (
	"id" serial PRIMARY KEY NOT NULL,
	"supplier_id" integer NOT NULL,
	"policy_type" text NOT NULL,
	"file_name" text NOT NULL,
	"file_url" text NOT NULL,
	"file_size" integer,
	"mime_type" text,
	"issue_date" date,
	"expiry_date" date,
	"notes" text,
	"version" integer DEFAULT 1,
	"uploaded_by" varchar,
	"status" "supplier_policy_status" DEFAULT 'pending',
	"rejection_reason" text,
	"reviewed_by" varchar,
	"reviewed_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "supplier_profile_change_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"supplier_id" integer NOT NULL,
	"user_id" varchar NOT NULL,
	"action" text NOT NULL,
	"field_changes" jsonb,
	"pending_change_id" integer,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "tenant_invitations" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer,
	"email" text NOT NULL,
	"first_name" text,
	"last_name" text,
	"role" "user_role" DEFAULT 'employee' NOT NULL,
	"token" text NOT NULL,
	"invited_by" varchar,
	"status" text DEFAULT 'pending' NOT NULL,
	"accepted_at" timestamp,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "tenant_invitations_token_unique" UNIQUE("token")
);
--> statement-breakpoint
ALTER TABLE "shifts" ADD COLUMN "supplier_id" integer;--> statement-breakpoint
ALTER TABLE "shifts" ADD COLUMN "controller_notes" text;--> statement-breakpoint
ALTER TABLE "shifts" ADD COLUMN "precheck_data" jsonb;--> statement-breakpoint
ALTER TABLE "shifts" ADD COLUMN "last_check_in_lat" text;--> statement-breakpoint
ALTER TABLE "shifts" ADD COLUMN "last_check_in_lng" text;--> statement-breakpoint
ALTER TABLE "shifts" ADD COLUMN "last_check_in_address" text;--> statement-breakpoint
ALTER TABLE "shifts" ADD COLUMN "supplier_approval_status" text;--> statement-breakpoint
ALTER TABLE "shifts" ADD COLUMN "supplier_approval_comment" text;--> statement-breakpoint
ALTER TABLE "shifts" ADD COLUMN "supplier_approved_at" timestamp;--> statement-breakpoint
ALTER TABLE "shifts" ADD COLUMN "supplier_approved_by" varchar;--> statement-breakpoint
ALTER TABLE "supplier_documents" ADD COLUMN "status" "supplier_document_status" DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE "supplier_documents" ADD COLUMN "rejection_reason" text;--> statement-breakpoint
ALTER TABLE "supplier_documents" ADD COLUMN "reviewed_by" varchar;--> statement-breakpoint
ALTER TABLE "supplier_documents" ADD COLUMN "reviewed_at" timestamp;--> statement-breakpoint
ALTER TABLE "supplier_documents" ADD COLUMN "display_name" text;--> statement-breakpoint
ALTER TABLE "supplier_documents" ADD COLUMN "expiry_date" date;--> statement-breakpoint
ALTER TABLE "supplier_documents" ADD COLUMN "notes" text;--> statement-breakpoint
ALTER TABLE "suppliers" ADD COLUMN "registered_office_country" text;--> statement-breakpoint
ALTER TABLE "suppliers" ADD COLUMN "company_category" text;--> statement-breakpoint
ALTER TABLE "suppliers" ADD COLUMN "company_status" text;--> statement-breakpoint
ALTER TABLE "suppliers" ADD COLUMN "country_of_origin" text;--> statement-breakpoint
ALTER TABLE "suppliers" ADD COLUMN "incorporation_date" text;--> statement-breakpoint
ALTER TABLE "suppliers" ADD COLUMN "sic_codes" text;--> statement-breakpoint
ALTER TABLE "suppliers" ADD COLUMN "accounts_next_due" text;--> statement-breakpoint
ALTER TABLE "suppliers" ADD COLUMN "accounts_last_made_up_date" text;--> statement-breakpoint
ALTER TABLE "suppliers" ADD COLUMN "account_category" text;--> statement-breakpoint
ALTER TABLE "suppliers" ADD COLUMN "accounts_account_ref_day" text;--> statement-breakpoint
ALTER TABLE "suppliers" ADD COLUMN "accounts_account_ref_month" text;--> statement-breakpoint
ALTER TABLE "suppliers" ADD COLUMN "returns_next_due" text;--> statement-breakpoint
ALTER TABLE "suppliers" ADD COLUMN "returns_last_made_up_date" text;--> statement-breakpoint
ALTER TABLE "suppliers" ADD COLUMN "previous_names" jsonb;--> statement-breakpoint
ALTER TABLE "suppliers" ADD COLUMN "mortgages" jsonb;--> statement-breakpoint
ALTER TABLE "suppliers" ADD COLUMN "last_review_at" timestamp;--> statement-breakpoint
ALTER TABLE "suppliers" ADD COLUMN "last_review_by" varchar;--> statement-breakpoint
ALTER TABLE "suppliers" ADD COLUMN "next_review_due_at" timestamp;--> statement-breakpoint
ALTER TABLE "suppliers" ADD COLUMN "self_billing_agreement_status" text DEFAULT 'none';--> statement-breakpoint
ALTER TABLE "suppliers" ADD COLUMN "self_billing_signatory_name" text;--> statement-breakpoint
ALTER TABLE "suppliers" ADD COLUMN "self_billing_signatory_position" text;--> statement-breakpoint
ALTER TABLE "suppliers" ADD COLUMN "self_billing_accepted_at" timestamp;--> statement-breakpoint
ALTER TABLE "suppliers" ADD COLUMN "self_billing_expiry_date" timestamp;--> statement-breakpoint
ALTER TABLE "suppliers" ADD COLUMN "self_billing_agreement_ref" text;--> statement-breakpoint
ALTER TABLE "suppliers" ADD COLUMN "billing_frequency" text DEFAULT 'monthly';--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "trading_name" text;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "address_line_1" text;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "address_line_2" text;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "city" text;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "county" text;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "postcode" text;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "website" text;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "company_status" text;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "sia_acs_number" text;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "subdomain" text;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "plan_id" integer;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "trial_ends_at" timestamp;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "onboarding_completed" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "failed_login_attempts" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "locked_until" timestamp;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "password_changed_at" timestamp;--> statement-breakpoint
ALTER TABLE "data_consents" ADD CONSTRAINT "data_consents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "data_consents" ADD CONSTRAINT "data_consents_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "data_erasure_requests" ADD CONSTRAINT "data_erasure_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "data_erasure_requests" ADD CONSTRAINT "data_erasure_requests_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "data_erasure_requests" ADD CONSTRAINT "data_erasure_requests_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_document_audit" ADD CONSTRAINT "supplier_document_audit_document_id_supplier_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."supplier_documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_document_audit" ADD CONSTRAINT "supplier_document_audit_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_field_requests" ADD CONSTRAINT "supplier_field_requests_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_field_requests" ADD CONSTRAINT "supplier_field_requests_requested_by_users_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_policies" ADD CONSTRAINT "supplier_policies_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_policies" ADD CONSTRAINT "supplier_policies_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_policies" ADD CONSTRAINT "supplier_policies_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_profile_change_log" ADD CONSTRAINT "supplier_profile_change_log_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_profile_change_log" ADD CONSTRAINT "supplier_profile_change_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_invitations" ADD CONSTRAINT "tenant_invitations_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_invitations" ADD CONSTRAINT "tenant_invitations_invited_by_users_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_documents" ADD CONSTRAINT "supplier_documents_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_last_review_by_users_id_fk" FOREIGN KEY ("last_review_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenants" ADD CONSTRAINT "tenants_subdomain_unique" UNIQUE("subdomain");