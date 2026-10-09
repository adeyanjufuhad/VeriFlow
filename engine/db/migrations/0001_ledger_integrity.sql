-- Ledger integrity, system accounts, RLS and Realtime.
-- Hand-written: Drizzle cannot express triggers. Statements are separated by
-- Drizzle's statement-breakpoint marker so the migrator runs them one at a time.

-- 1) Append-only: postings and journal entries can never be updated, deleted or truncated.
--    Mistakes are corrected with a new reversing entry.
CREATE FUNCTION ledger_forbid_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'ledger is append-only: % on % is not allowed', TG_OP, TG_TABLE_NAME
    USING ERRCODE = 'restrict_violation';
END
$$;
--> statement-breakpoint
CREATE TRIGGER postings_append_only BEFORE UPDATE OR DELETE ON "postings"
  FOR EACH ROW EXECUTE FUNCTION ledger_forbid_mutation();
--> statement-breakpoint
CREATE TRIGGER postings_no_truncate BEFORE TRUNCATE ON "postings"
  FOR EACH STATEMENT EXECUTE FUNCTION ledger_forbid_mutation();
--> statement-breakpoint
CREATE TRIGGER journal_entries_append_only BEFORE UPDATE OR DELETE ON "journal_entries"
  FOR EACH ROW EXECUTE FUNCTION ledger_forbid_mutation();
--> statement-breakpoint
CREATE TRIGGER journal_entries_no_truncate BEFORE TRUNCATE ON "journal_entries"
  FOR EACH STATEMENT EXECUTE FUNCTION ledger_forbid_mutation();
--> statement-breakpoint

-- 2) Balanced entries: checked at COMMIT (deferred) so postings can be inserted one by one.
--    Every entry needs at least two postings and debits must equal credits.
CREATE FUNCTION ledger_check_entry_balanced() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_entry uuid;
  v_debits numeric;
  v_credits numeric;
  v_count integer;
BEGIN
  IF TG_TABLE_NAME = 'journal_entries' THEN
    v_entry := NEW.id;
  ELSE
    v_entry := NEW.entry_id;
  END IF;

  SELECT coalesce(sum(amount_kobo) FILTER (WHERE direction = 'debit'), 0),
         coalesce(sum(amount_kobo) FILTER (WHERE direction = 'credit'), 0),
         count(*)
    INTO v_debits, v_credits, v_count
    FROM postings WHERE entry_id = v_entry;

  IF v_count < 2 OR v_debits <> v_credits THEN
    RAISE EXCEPTION 'unbalanced journal entry %: % postings, debits %, credits %',
      v_entry, v_count, v_debits, v_credits
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NULL;
END
$$;
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER postings_entry_balanced AFTER INSERT ON "postings"
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION ledger_check_entry_balanced();
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER journal_entries_has_balanced_postings AFTER INSERT ON "journal_entries"
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION ledger_check_entry_balanced();
--> statement-breakpoint

-- 3) System ledger accounts (one of each, enforced by the partial unique index).
INSERT INTO "ledger_accounts" ("owner_type", "owner_id", "type") VALUES
  ('system', NULL, 'provider_clearing'),
  ('system', NULL, 'payouts_pending'),
  ('system', NULL, 'fee_income')
ON CONFLICT DO NOTHING;
--> statement-breakpoint

-- 4) Row Level Security: deny everything to anon/authenticated by default.
--    The engine connects as the table owner / postgres role, which bypasses RLS.
--    Dashboard read policies are added once the dashboard auth approach is agreed.
ALTER TABLE "traders" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "suppliers" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "ledger_accounts" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "journal_entries" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "postings" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "credit_lines" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "drawdowns" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "debts" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "provider_events" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "outbox_events" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint

-- 5) Supabase Realtime for the live dashboard. No-op on plain Postgres (no such publication).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE "postings", "drawdowns", "outbox_events";
  END IF;
END
$$;
