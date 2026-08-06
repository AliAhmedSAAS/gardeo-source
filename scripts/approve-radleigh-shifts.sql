-- Approve all Radleigh shifts for invoicing
-- Supplier ID: 41 (RADLEIGH SECURITY & FM LIMITED)
-- Executed: 2026-03-23
--
-- Pre-execution state:
--   1,210 shifts with finance_status = 'pending'
--     676 shifts with finance_status = 'approved'
--
-- Post-execution state (verified):
--   1,886 shifts with finance_status = 'approved'

UPDATE shifts
SET finance_status = 'approved', finance_approved_at = NOW()
WHERE supplier_id = 41
AND finance_status = 'pending';
