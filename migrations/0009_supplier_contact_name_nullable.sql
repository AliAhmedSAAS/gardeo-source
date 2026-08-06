-- Migration: Make supplier contact_name nullable (Task #68)
-- Removes NOT NULL constraint so suppliers can be created without a contact name

ALTER TABLE "suppliers" ALTER COLUMN "contact_name" DROP NOT NULL;
