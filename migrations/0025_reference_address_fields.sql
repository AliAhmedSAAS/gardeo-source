-- Personal reference address fields (GFM Track parity)

ALTER TABLE "references" ADD COLUMN IF NOT EXISTS "referee_address" text;
ALTER TABLE "references" ADD COLUMN IF NOT EXISTS "referee_postcode" text;
