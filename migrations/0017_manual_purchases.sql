CREATE TABLE IF NOT EXISTS "manual_purchases" (
  "id" serial PRIMARY KEY NOT NULL,
  "tenant_id" integer NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "purchase_date" date NOT NULL,
  "vendor_name" text NOT NULL,
  "vendor_vat_number" text,
  "description" text NOT NULL,
  "net_amount" numeric(12,2) NOT NULL,
  "vat_rate" numeric(5,2) NOT NULL DEFAULT 0,
  "vat_amount" numeric(12,2) NOT NULL DEFAULT 0,
  "gross_amount" numeric(12,2) NOT NULL,
  "expense_category" text,
  "vat_status" text DEFAULT 'standard',
  "payment_status" text DEFAULT 'unpaid',
  "bank_reference" text,
  "receipt_url" text,
  "notes" text,
  "duplicate_of_bank_transaction_id" integer,
  "created_by" varchar REFERENCES "users"("id"),
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "manual_purchases_tenant_date_idx"
  ON "manual_purchases" ("tenant_id", "purchase_date");

CREATE INDEX IF NOT EXISTS "manual_purchases_tenant_vendor_idx"
  ON "manual_purchases" ("tenant_id", "vendor_name");
