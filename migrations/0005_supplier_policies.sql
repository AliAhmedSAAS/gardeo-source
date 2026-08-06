-- Migration: Supplier Policies table (ISO 9001 / HMRC UK compliance)
-- Policies are separate from supplier_documents (which are one-off compliance docs).
-- Policies are ongoing company-level documents (Health & Safety, GDPR, IR35, etc.)
-- that must be kept current with issue/expiry dates and reviewed by admin.

CREATE TABLE IF NOT EXISTS supplier_policies (
  id                SERIAL PRIMARY KEY,
  supplier_id       INTEGER NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  policy_type       TEXT NOT NULL,
  file_name         TEXT NOT NULL,
  file_url          TEXT NOT NULL,
  file_size         INTEGER,
  mime_type         TEXT,
  issue_date        DATE,
  expiry_date       DATE,
  notes             TEXT,
  version           INTEGER DEFAULT 1,
  uploaded_by       VARCHAR REFERENCES users(id),
  status            TEXT NOT NULL DEFAULT 'pending',    -- pending | approved | rejected
  rejection_reason  TEXT,
  reviewed_by       VARCHAR REFERENCES users(id),
  reviewed_at       TIMESTAMP,
  created_at        TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_supplier_policies_supplier_id ON supplier_policies(supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_policies_status ON supplier_policies(status);
