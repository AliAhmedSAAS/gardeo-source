ALTER TABLE "suppliers" ADD COLUMN "data_visibility_months" integer;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "supplier_data_visibility_months" integer;