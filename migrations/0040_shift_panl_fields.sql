-- PANL reconciliation fields on live confirmed shifts
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS expense numeric(12, 2) DEFAULT 0;
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS holiday_hours numeric(10, 2) DEFAULT 0;
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS deduction_hours numeric(10, 2) DEFAULT 0;
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS hours_override numeric(10, 2);
