-- Optional document name, expiry date, notes; and "other" document type
ALTER TABLE "supplier_documents" ADD COLUMN IF NOT EXISTS "display_name" text;
ALTER TABLE "supplier_documents" ADD COLUMN IF NOT EXISTS "expiry_date" date;
ALTER TABLE "supplier_documents" ADD COLUMN IF NOT EXISTS "notes" text;

-- Add 'other' to supplier_document_type enum (PostgreSQL: add value if not exists)
DO $$ BEGIN
  ALTER TYPE supplier_document_type ADD VALUE 'other';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
