-- FM billing: link invoices and line items to FM suppliers/jobs
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "fm_supplier_id" integer;
ALTER TABLE "invoice_line_items" ADD COLUMN IF NOT EXISTS "fm_job_id" integer;
ALTER TABLE "client_invoice_line_items" ADD COLUMN IF NOT EXISTS "fm_job_id" integer;

CREATE INDEX IF NOT EXISTS "idx_invoices_fm_supplier" ON "invoices" ("fm_supplier_id");
CREATE INDEX IF NOT EXISTS "idx_invoice_line_items_fm_job" ON "invoice_line_items" ("fm_job_id");
CREATE INDEX IF NOT EXISTS "idx_client_invoice_line_items_fm_job" ON "client_invoice_line_items" ("fm_job_id");
