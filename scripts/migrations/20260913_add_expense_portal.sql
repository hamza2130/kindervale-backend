-- expenses had no way to tell a Daycare expense from a Kindervale one at all -- the frontend
-- hardcoded "Kindervale" on every row it displayed, which silently hid every expense from
-- Daycare Admin's view (their page filters to portal === "Daycare", so it always matched zero
-- rows regardless of how many expenses existed).
--
-- Defaults existing rows to 'Kindervale' so they keep showing exactly where they already did.
-- Mirrored in src/modules/database/database.service.ts, which applies this on every boot.

ALTER TABLE "expenses"
  ADD COLUMN IF NOT EXISTS "portal" text NOT NULL DEFAULT 'Kindervale';
