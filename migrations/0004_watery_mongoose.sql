CREATE TYPE "public"."leave_type" AS ENUM('annual_leave', 'sick_leave', 'personal', 'training');--> statement-breakpoint
CREATE TYPE "public"."time_off_status" AS ENUM('pending', 'approved', 'rejected', 'cancelled');--> statement-breakpoint
CREATE TABLE "time_off_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"employee_id" integer NOT NULL,
	"tenant_id" integer NOT NULL,
	"leave_type" "leave_type" NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"total_days" integer NOT NULL,
	"notes" text,
	"status" time_off_status DEFAULT 'pending' NOT NULL,
	"reviewed_by_user_id" varchar,
	"reviewed_at" timestamp,
	"review_note" text,
	"requested_by_user_id" varchar NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "time_off_requests" ADD CONSTRAINT "time_off_requests_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_off_requests" ADD CONSTRAINT "time_off_requests_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_off_requests" ADD CONSTRAINT "time_off_requests_reviewed_by_user_id_users_id_fk" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_off_requests" ADD CONSTRAINT "time_off_requests_requested_by_user_id_users_id_fk" FOREIGN KEY ("requested_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_time_off_tenant_id" ON "time_off_requests" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_time_off_employee_id" ON "time_off_requests" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "idx_time_off_tenant_status" ON "time_off_requests" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "idx_time_off_employee_dates" ON "time_off_requests" USING btree ("employee_id","start_date","end_date");