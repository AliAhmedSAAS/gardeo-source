-- Separate late hours from deduction_hours (book-on / payroll / bills)
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS late_hours numeric(10, 2) DEFAULT 0;
ALTER TABLE payroll_applied_lines ADD COLUMN IF NOT EXISTS late_hours numeric(10, 2) DEFAULT 0;
ALTER TABLE payroll_bill_lines ADD COLUMN IF NOT EXISTS late_hours numeric(10, 2) DEFAULT 0;

-- Migrate prior late stored as negative deduction_hours
UPDATE shifts
SET late_hours = ABS(deduction_hours),
    deduction_hours = 0
WHERE COALESCE(late_minutes, 0) > 0
  AND COALESCE(deduction_hours, 0) < 0
  AND COALESCE(late_hours, 0) = 0;
