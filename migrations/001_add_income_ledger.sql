-- Adds the `income` ledger.
--
-- Daycare is not billed per child: one lump sum arrives every two months covering everyone
-- and is entered by hand. The `fees` table cannot hold that — `student_id` is required there
-- and every row is a unique invoice, so a pooled payment has no child to attach to. This is
-- the counterpart to `expenses`: same shape, opposite direction.
--
-- Purely additive: it creates one new table and touches nothing that already exists.
-- Safe to re-run.
--
--   psql "$DATABASE_URL" -f migrations/001_add_income_ledger.sql

CREATE TABLE IF NOT EXISTS "income" (
	"id"           text PRIMARY KEY NOT NULL,
	"title"        text NOT NULL,
	"category"     text DEFAULT 'Fee Collection' NOT NULL,
	"amount"       numeric(10, 2) NOT NULL,
	-- Date the money was received.
	"date"         date NOT NULL,
	-- Inclusive range the payment covers; both null for a one-off receipt.
	"period_start" date,
	"period_end"   date,
	-- 'Kindervale' or 'Daycare' — keeps the two portals' finances separate.
	"portal"       text DEFAULT 'Daycare' NOT NULL,
	"notes"        text,
	"created_by"   text,
	"created_at"   timestamp DEFAULT now() NOT NULL,
	"updated_at"   timestamp DEFAULT now() NOT NULL
);

DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM pg_constraint WHERE conname = 'income_created_by_users_id_fk'
	) THEN
		ALTER TABLE "income"
			ADD CONSTRAINT "income_created_by_users_id_fk"
			FOREIGN KEY ("created_by") REFERENCES "public"."users"("id")
			ON DELETE set null ON UPDATE no action;
	END IF;
END $$;

-- Reporting reads this by portal over a date range.
CREATE INDEX IF NOT EXISTS "income_portal_date_idx" ON "income" ("portal", "date");
