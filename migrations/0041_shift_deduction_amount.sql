-- Persist self-employed / payroll deduction (£) on the shift for reuse across screens
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS deduction_amount numeric(12, 2) DEFAULT 0;
