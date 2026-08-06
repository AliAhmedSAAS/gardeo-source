CREATE TYPE "public"."ai_learning_domain" AS ENUM('scheduling', 'email_classification', 'email_action');--> statement-breakpoint
CREATE TYPE "public"."email_category" AS ENUM('new_shift', 'cancellation', 'lateness', 'blowout', 'new_client', 'site_change', 'officer_replacement', 'schedule_change', 'general_enquiry');--> statement-breakpoint
CREATE TYPE "public"."email_processing_status" AS ENUM('unread', 'classified', 'action_proposed', 'action_taken', 'completed', 'ignored');--> statement-breakpoint
CREATE TYPE "public"."proposed_action_status" AS ENUM('pending', 'approved', 'rejected', 'executed', 'failed');--> statement-breakpoint
CREATE TABLE "ai_learning_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"domain" "ai_learning_domain" NOT NULL,
	"input_context" jsonb,
	"ai_proposal" jsonb,
	"status" "ai_decision_status" DEFAULT 'suggested' NOT NULL,
	"feedback" text,
	"operator_correction" text,
	"correct_action_type" varchar(100),
	"correct_action_params" jsonb,
	"batch_id" varchar(100),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"decided_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "email_auto_approve_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer NOT NULL,
	"action_type" varchar(100) NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"updated_by" varchar(255),
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_classifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"email_id" integer NOT NULL,
	"tenant_id" integer NOT NULL,
	"category" "email_category" NOT NULL,
	"confidence" integer DEFAULT 0,
	"extracted_entities" jsonb,
	"reasoning" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "employee_immigration" (
	"id" serial PRIMARY KEY NOT NULL,
	"employee_id" integer NOT NULL,
	"tenant_id" integer,
	"passport_doc_no" text,
	"passport_country" text,
	"passport_issue_date" date,
	"passport_expiry_date" date,
	"visa_needed" boolean DEFAULT false,
	"visa_type" text,
	"visa_issue_date" date,
	"visa_expiry_date" date,
	"visa_date_of_entry" date,
	"share_code" text,
	"share_code_expiry" date,
	"brp_needed" boolean DEFAULT false,
	"brp_number" text,
	"brp_expiry" date,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "inbox_emails" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer NOT NULL,
	"outlook_message_id" varchar(500) NOT NULL,
	"from_address" varchar(500) NOT NULL,
	"from_name" varchar(255),
	"subject" varchar(1000),
	"body_preview" text,
	"body_text" text,
	"received_at" timestamp NOT NULL,
	"processing_status" "email_processing_status" DEFAULT 'unread' NOT NULL,
	"ai_summary" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "proposed_actions" (
	"id" serial PRIMARY KEY NOT NULL,
	"email_id" integer NOT NULL,
	"tenant_id" integer NOT NULL,
	"action_type" varchar(100) NOT NULL,
	"action_label" varchar(500) NOT NULL,
	"action_params" jsonb,
	"status" "proposed_action_status" DEFAULT 'pending' NOT NULL,
	"auto_approved" boolean DEFAULT false,
	"decided_by" varchar(255),
	"rejection_reason" text,
	"execution_result" jsonb,
	"learning_event_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"decided_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "tenant_email_connections" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer NOT NULL,
	"provider" varchar(50) DEFAULT 'outlook' NOT NULL,
	"client_id" text NOT NULL,
	"client_secret" text NOT NULL,
	"azure_tenant_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"token_expires_at" timestamp,
	"polling_enabled" boolean DEFAULT false NOT NULL,
	"polling_interval_minutes" integer DEFAULT 2 NOT NULL,
	"connected_email" varchar(255),
	"connection_status" varchar(50) DEFAULT 'disconnected' NOT NULL,
	"last_polled_at" timestamp,
	"last_error" text,
	"connected_by" varchar(255),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "tenant_email_connections_tenant_id_unique" UNIQUE("tenant_id")
);
--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "external_uploaded_at" timestamp;--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "place_of_birth" text;--> statement-breakpoint
ALTER TABLE "employment_history" ADD COLUMN "verification_status" text;--> statement-breakpoint
ALTER TABLE "employment_history" ADD COLUMN "submitted_date" date;--> statement-breakpoint
ALTER TABLE "employment_history" ADD COLUMN "referee_address" text;--> statement-breakpoint
ALTER TABLE "employment_history" ADD COLUMN "referee_postcode" text;--> statement-breakpoint
ALTER TABLE "references" ADD COLUMN "verification_status" text;--> statement-breakpoint
ALTER TABLE "email_classifications" ADD CONSTRAINT "email_classifications_email_id_inbox_emails_id_fk" FOREIGN KEY ("email_id") REFERENCES "public"."inbox_emails"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_immigration" ADD CONSTRAINT "employee_immigration_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_immigration" ADD CONSTRAINT "employee_immigration_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposed_actions" ADD CONSTRAINT "proposed_actions_email_id_inbox_emails_id_fk" FOREIGN KEY ("email_id") REFERENCES "public"."inbox_emails"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_ai_learning_tenant_domain" ON "ai_learning_events" USING btree ("tenant_id","domain");--> statement-breakpoint
CREATE INDEX "idx_ai_learning_batch" ON "ai_learning_events" USING btree ("batch_id");--> statement-breakpoint
CREATE INDEX "idx_auto_approve_tenant" ON "email_auto_approve_settings" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_email_class_email" ON "email_classifications" USING btree ("email_id");--> statement-breakpoint
CREATE INDEX "idx_email_class_tenant" ON "email_classifications" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_employee_immigration_employee" ON "employee_immigration" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "idx_employee_immigration_tenant" ON "employee_immigration" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_inbox_emails_tenant" ON "inbox_emails" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_inbox_emails_outlook_id" ON "inbox_emails" USING btree ("outlook_message_id");--> statement-breakpoint
CREATE INDEX "idx_proposed_actions_email" ON "proposed_actions" USING btree ("email_id");--> statement-breakpoint
CREATE INDEX "idx_proposed_actions_tenant" ON "proposed_actions" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_proposed_actions_status" ON "proposed_actions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_email_conn_tenant" ON "tenant_email_connections" USING btree ("tenant_id");