-- Money received, recorded as a ledger entry rather than an invoice.
--
-- Daycare is not billed per child: one lump sum arrives every two months covering everyone
-- and is entered by hand. The "fees" table cannot hold that -- student_id is required there
-- and every row is a unique invoice, so a pooled payment has no child to attach to.
-- This is the counterpart to "expenses": same shape, opposite direction.
--
-- period_start/period_end describe what a payment covers (e.g. Sep-Oct), which is not
-- necessarily the day it landed ("date").

CREATE TABLE IF NOT EXISTS "income" (
  "id"           text PRIMARY KEY NOT NULL,
  "title"        text NOT NULL,
  "category"     text NOT NULL DEFAULT 'Fee Collection',
  "amount"       numeric(10, 2) NOT NULL,
  "date"         date NOT NULL,
  "period_start" date,
  "period_end"   date,
  "portal"       text NOT NULL DEFAULT 'Daycare',
  "notes"        text,
  "created_by"   text REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at"   timestamp NOT NULL DEFAULT now(),
  "updated_at"   timestamp NOT NULL DEFAULT now()
);

-- Reporting reads this by portal over a date range.
CREATE INDEX IF NOT EXISTS "income_portal_date_idx" ON "income" ("portal", "date");
