-- Document review status and audit trail for supplier documents
DO $$ BEGIN
  CREATE TYPE supplier_document_status AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE supplier_document_audit_action AS ENUM ('uploaded', 'approved', 'rejected');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "supplier_documents" ADD COLUMN IF NOT EXISTS "status" supplier_document_status DEFAULT 'pending';
ALTER TABLE "supplier_documents" ADD COLUMN IF NOT EXISTS "rejection_reason" text;
ALTER TABLE "supplier_documents" ADD COLUMN IF NOT EXISTS "reviewed_by" varchar REFERENCES "users"("id");
ALTER TABLE "supplier_documents" ADD COLUMN IF NOT EXISTS "reviewed_at" timestamp;

CREATE TABLE IF NOT EXISTS "supplier_document_audit" (
  "id" serial PRIMARY KEY NOT NULL,
  "document_id" integer NOT NULL REFERENCES "supplier_documents"("id"),
  "action" supplier_document_audit_action NOT NULL,
  "user_id" varchar REFERENCES "users"("id"),
  "details" jsonb,
  "created_at" timestamp DEFAULT now()
);
