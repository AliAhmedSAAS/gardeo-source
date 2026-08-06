-- Delta Force Group (supplier 14) Payment Reallocation Migration
-- Includes Delta Facilities bank transactions (IDs 9974, 9979, 9897) alongside
-- Delta Force Group transactions for chronological allocation against 5 invoices.
--
-- Chronological transaction order (task listing order for same-date ties):
--   9974 (2021-08-04), 9979 (2021-08-04), 9897 (2021-08-11),
--   7996 (2022-05-25), 7976 (2022-05-31), 7939 (2022-06-07),
--   6519 (2022-10-13), 6493 (2022-10-17), 6494 (2022-10-17), 5601 (2023-01-25)
--
-- Total payments: £110,842.66 across 10 transactions
-- Total invoices: £111,076.44 across 5 invoices
-- Result: 4 invoices fully paid, 1 partially paid (£233.78 remaining)

BEGIN;

DELETE FROM bank_transaction_allocations WHERE supplier_id = 14;

UPDATE bank_transactions
SET allocated_amount = 0, is_allocated = false
WHERE id IN (9974, 9979, 9897, 7996, 7976, 7939, 6519, 6493, 6494, 5601);

UPDATE invoices
SET status = 'approved', paid_at = NULL, paid_by = NULL, payment_date = NULL
WHERE supplier_id = 14 AND status = 'paid';

UPDATE bank_transactions SET supplier_id = 14 WHERE id IN (9974, 9979, 9897);

INSERT INTO bank_transaction_allocations (tenant_id, bank_transaction_id, invoice_id, supplier_id, amount, notes) VALUES
(7, 9974, 1491, 14, 8520.80, 'Delta Force Group reallocation'),
(7, 9979, 1491, 14, 2450.50, 'Delta Force Group reallocation'),
(7, 9897, 1491, 14, 12499.96, 'Delta Force Group reallocation'),
(7, 9897, 1504, 14, 0.04, 'Delta Force Group reallocation'),
(7, 7996, 1504, 14, 4560.00, 'Delta Force Group reallocation'),
(7, 7976, 1504, 14, 8549.90, 'Delta Force Group reallocation'),
(7, 7976, 1506, 14, 0.10, 'Delta Force Group reallocation'),
(7, 7939, 1506, 14, 19999.90, 'Delta Force Group reallocation'),
(7, 7939, 1512, 14, 0.10, 'Delta Force Group reallocation'),
(7, 6519, 1512, 14, 12798.00, 'Delta Force Group reallocation'),
(7, 6493, 1512, 14, 12798.00, 'Delta Force Group reallocation'),
(7, 6494, 1512, 14, 17550.86, 'Delta Force Group reallocation'),
(7, 6494, 1517, 14, 0.10, 'Delta Force Group reallocation'),
(7, 5601, 1517, 14, 11114.40, 'Delta Force Group reallocation');

UPDATE bank_transactions SET allocated_amount = 8520.80, is_allocated = true WHERE id = 9974;
UPDATE bank_transactions SET allocated_amount = 2450.50, is_allocated = true WHERE id = 9979;
UPDATE bank_transactions SET allocated_amount = 12500.00, is_allocated = true WHERE id = 9897;
UPDATE bank_transactions SET allocated_amount = 4560.00, is_allocated = true WHERE id = 7996;
UPDATE bank_transactions SET allocated_amount = 8550.00, is_allocated = true WHERE id = 7976;
UPDATE bank_transactions SET allocated_amount = 20000.00, is_allocated = true WHERE id = 7939;
UPDATE bank_transactions SET allocated_amount = 12798.00, is_allocated = true WHERE id = 6519;
UPDATE bank_transactions SET allocated_amount = 12798.00, is_allocated = true WHERE id = 6493;
UPDATE bank_transactions SET allocated_amount = 17550.96, is_allocated = true WHERE id = 6494;
UPDATE bank_transactions SET allocated_amount = 11114.40, is_allocated = true WHERE id = 5601;

UPDATE invoices SET status = 'paid', paid_at = '2021-08-11', payment_date = '2021-08-11' WHERE id = 1491;
UPDATE invoices SET status = 'paid', paid_at = '2022-05-31', payment_date = '2022-05-31' WHERE id = 1504;
UPDATE invoices SET status = 'paid', paid_at = '2022-06-07', payment_date = '2022-06-07' WHERE id = 1506;
UPDATE invoices SET status = 'paid', paid_at = '2022-10-17', payment_date = '2022-10-17' WHERE id = 1512;

COMMIT;
