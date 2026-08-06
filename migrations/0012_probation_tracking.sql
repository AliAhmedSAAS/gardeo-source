CREATE TYPE "public"."probation_status" AS ENUM('active', 'passed', 'extended', 'failed');--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "default_probation_weeks" integer DEFAULT 12;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "probation_records" (
	"id" serial PRIMARY KEY NOT NULL,
	"employee_id" integer NOT NULL,
	"tenant_id" integer NOT NULL,
	"start_date" date NOT NULL,
	"review_date" date NOT NULL,
	"extended_review_date" date,
	"status" "probation_status" DEFAULT 'active' NOT NULL,
	"outcome_notes" text,
	"reviewed_by" varchar,
	"reviewed_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "probation_records" ADD CONSTRAINT "probation_records_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "probation_records" ADD CONSTRAINT "probation_records_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "probation_records" ADD CONSTRAINT "probation_records_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_probation_tenant_id" ON "probation_records" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_probation_employee_id" ON "probation_records" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_probation_tenant_status" ON "probation_records" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_probation_review_date" ON "probation_records" USING btree ("tenant_id","review_date");
