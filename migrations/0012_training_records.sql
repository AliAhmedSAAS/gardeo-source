CREATE TYPE "public"."training_type" AS ENUM('first_aid', 'manual_handling', 'fire_marshal', 'conflict_resolution', 'sia_refresher', 'custom');--> statement-breakpoint
CREATE TYPE "public"."training_status" AS ENUM('not_started', 'in_progress', 'completed', 'expired');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "training_records" (
	"id" serial PRIMARY KEY NOT NULL,
	"employee_id" integer NOT NULL,
	"tenant_id" integer NOT NULL,
	"training_type" "training_type" DEFAULT 'custom' NOT NULL,
	"training_name" text NOT NULL,
	"provider" text,
	"completed_date" date,
	"expiry_date" date,
	"certificate_url" text,
	"status" "training_status" DEFAULT 'not_started' NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "training_records" ADD CONSTRAINT "training_records_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "training_records" ADD CONSTRAINT "training_records_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_training_records_tenant" ON "training_records" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_training_records_employee" ON "training_records" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_training_records_tenant_employee" ON "training_records" USING btree ("tenant_id","employee_id");
