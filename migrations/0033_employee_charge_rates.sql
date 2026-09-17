ALTER TABLE IF EXISTS "employee_charge_rates" ADD COLUMN IF NOT EXISTS "id" serial;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "employee_charge_rates" (
  "id" serial PRIMARY KEY NOT NULL,
  "tenant_id" integer NOT NULL REFERENCES "tenants"("id"),
  "employee_id" integer NOT NULL REFERENCES "employees"("id") ON DELETE cascade,
  "duty_type_id" integer NOT NULL,
  "hourly_charge_rate" numeric(10, 2) NOT NULL,
  "effective_from" date NOT NULL,
  "effective_to" date,
  "notes" text,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_employee_charge_rates_employee" ON "employee_charge_rates" ("employee_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_employee_charge_rates_emp_duty" ON "employee_charge_rates" ("employee_id", "duty_type_id", "effective_from");
