-- Add offer_letter_url column to applicants table for object storage link
ALTER TABLE applicants ADD COLUMN IF NOT EXISTS offer_letter_url text;
