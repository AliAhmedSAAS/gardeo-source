-- Drop all Radleigh Security & FM Limited invoices (IDs 1617-1674)
-- Supplier ID: 41 (RADLEIGH SECURITY & FM LIMITED)
-- Executed: 2026-03-23
--
-- Pre-execution counts:
--   invoices:                     58 rows (IDs 1617-1674)
--   invoice_line_items:        1,886 rows
--   bank_transaction_allocations:  45 rows
--   bank_transactions affected:    18 rows
--
-- Post-execution counts (all zero - verified):
--   invoices WHERE id BETWEEN 1617 AND 1674:                     0
--   invoice_line_items WHERE invoice_id BETWEEN 1617 AND 1674:   0
--   bank_transaction_allocations WHERE invoice_id BETWEEN ...     0
--   credit_notes WHERE invoice_id BETWEEN 1617 AND 1674:         0
--   debit_notes WHERE invoice_id BETWEEN 1617 AND 1674:          0
--   financial_documents WHERE invoice_id BETWEEN 1617 AND 1674:  0
--   auto_classification_suggestions WHERE invoice_id BETWEEN ..  0

BEGIN;

-- Precondition: verify all targeted invoices belong to supplier_id 41
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM invoices
    WHERE id BETWEEN 1617 AND 1674
    AND supplier_id != 41
  ) THEN
    RAISE EXCEPTION 'Aborting: found invoices in range 1617-1674 not belonging to supplier_id 41';
  END IF;
END
$$;

-- Step 1: Delete bank_transaction_allocations linked to Radleigh invoices
-- Scoped by both invoice_id range and supplier_id for safety
-- Result: DELETE 45
DELETE FROM bank_transaction_allocations
WHERE invoice_id IN (
  SELECT id FROM invoices WHERE id BETWEEN 1617 AND 1674 AND supplier_id = 41
);

-- Step 2: Reset is_allocated on affected bank transactions
-- Only reset if the transaction has no remaining allocations
-- Affected IDs: 10599,5804,10132,11145,5950,5989,10436,5755,
--               4998,5404,5213,5609,10104,10064,10926,11391,10773,10065
-- Result: UPDATE 18
UPDATE bank_transactions
SET is_allocated = false
WHERE id IN (
    10599, 5804, 10132, 11145, 5950, 5989, 10436, 5755,
    4998, 5404, 5213, 5609, 10104, 10064, 10926, 11391, 10773, 10065
)
AND id NOT IN (
    SELECT DISTINCT bank_transaction_id FROM bank_transaction_allocations
);

-- Step 3: Delete all invoice line items for the 58 Radleigh invoices
-- Result: DELETE 1886
DELETE FROM invoice_line_items
WHERE invoice_id IN (
  SELECT id FROM invoices WHERE id BETWEEN 1617 AND 1674 AND supplier_id = 41
);

-- Step 4: Delete all 58 Radleigh invoices
-- Result: DELETE 58
DELETE FROM invoices
WHERE id BETWEEN 1617 AND 1674
AND supplier_id = 41;

COMMIT;
