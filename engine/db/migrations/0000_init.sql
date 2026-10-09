CREATE TABLE "credit_lines" (
	"trader_id" uuid PRIMARY KEY NOT NULL,
	"limit_kobo" bigint DEFAULT 0 NOT NULL,
	"sweep_rate_bps" integer DEFAULT 1000 NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "credit_lines_limit_nonneg" CHECK ("credit_lines"."limit_kobo" >= 0),
	CONSTRAINT "credit_lines_sweep_rate" CHECK ("credit_lines"."sweep_rate_bps" BETWEEN 0 AND 10000),
	CONSTRAINT "credit_lines_status" CHECK (status IN ('active', 'paused'))
);
--> statement-breakpoint
CREATE TABLE "debts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trader_id" uuid NOT NULL,
	"debtor_name" text NOT NULL,
	"debtor_phone" text,
	"amount_kobo" bigint NOT NULL,
	"payment_reference" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"paid_at" timestamp with time zone,
	CONSTRAINT "debts_payment_reference_unique" UNIQUE("payment_reference"),
	CONSTRAINT "debts_status" CHECK (status IN ('open', 'paid', 'cancelled')),
	CONSTRAINT "debts_amount_positive" CHECK ("debts"."amount_kobo" > 0)
);
--> statement-breakpoint
CREATE TABLE "drawdowns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trader_id" uuid NOT NULL,
	"supplier_id" uuid NOT NULL,
	"amount_kobo" bigint NOT NULL,
	"fee_kobo" bigint DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'pending_approval' NOT NULL,
	"approval_token_hash" text NOT NULL,
	"token_expires_at" timestamp with time zone NOT NULL,
	"client_request_id" text,
	"provider_transfer_reference" text,
	"failure_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "drawdowns_approval_token_hash_unique" UNIQUE("approval_token_hash"),
	CONSTRAINT "drawdowns_provider_transfer_reference_unique" UNIQUE("provider_transfer_reference"),
	CONSTRAINT "drawdowns_trader_client_request" UNIQUE("trader_id","client_request_id"),
	CONSTRAINT "drawdowns_status" CHECK (status IN ('pending_approval', 'approved', 'paid', 'failed', 'expired', 'cancelled')),
	CONSTRAINT "drawdowns_amount_positive" CHECK ("drawdowns"."amount_kobo" > 0),
	CONSTRAINT "drawdowns_fee_nonneg" CHECK ("drawdowns"."fee_kobo" >= 0)
);
--> statement-breakpoint
CREATE TABLE "journal_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"idempotency_key" text NOT NULL,
	"kind" text NOT NULL,
	"trader_id" uuid,
	"reference" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "journal_entries_idempotency_key_unique" UNIQUE("idempotency_key")
);
--> statement-breakpoint
CREATE TABLE "ledger_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_type" text NOT NULL,
	"owner_id" uuid,
	"type" text NOT NULL,
	"currency" text DEFAULT 'NGN' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ledger_accounts_owner_type" CHECK (owner_type IN ('trader', 'system')),
	CONSTRAINT "ledger_accounts_type" CHECK (type IN ('provider_clearing', 'trader_wallet', 'trader_savings', 'loan_receivable', 'payouts_pending', 'fee_income')),
	CONSTRAINT "ledger_accounts_owner_consistent" CHECK (("ledger_accounts"."owner_type" = 'trader' AND "ledger_accounts"."owner_id" IS NOT NULL) OR ("ledger_accounts"."owner_type" = 'system' AND "ledger_accounts"."owner_id" IS NULL))
);
--> statement-breakpoint
CREATE TABLE "outbox_events" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "outbox_events_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"trader_id" uuid,
	"type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"delivered_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "postings" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "postings_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"entry_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"trader_id" uuid,
	"direction" text NOT NULL,
	"amount_kobo" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "postings_direction" CHECK (direction IN ('debit', 'credit')),
	CONSTRAINT "postings_amount_positive" CHECK ("postings"."amount_kobo" > 0)
);
--> statement-breakpoint
CREATE TABLE "provider_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" text NOT NULL,
	"event_id" text NOT NULL,
	"event_type" text NOT NULL,
	"signature_valid" boolean NOT NULL,
	"payload_summary" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"processed_at" timestamp with time zone,
	"error" text,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "provider_events_provider_event" UNIQUE("provider","event_id")
);
--> statement-breakpoint
CREATE TABLE "suppliers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trader_id" uuid NOT NULL,
	"name" text NOT NULL,
	"bank_code" text NOT NULL,
	"account_number" text NOT NULL,
	"account_name" text,
	"provider_recipient_code" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "suppliers_trader_bank_account" UNIQUE("trader_id","bank_code","account_number")
);
--> statement-breakpoint
CREATE TABLE "traders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"phone" text NOT NULL,
	"business_type" text,
	"kyc_status" text DEFAULT 'mocked' NOT NULL,
	"virtual_account_number" text,
	"virtual_account_bank" text,
	"provider_customer_id" text,
	"pin_hash" text,
	"pin_failed_attempts" integer DEFAULT 0 NOT NULL,
	"pin_locked_until" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "traders_phone_unique" UNIQUE("phone"),
	CONSTRAINT "traders_virtual_account_number_unique" UNIQUE("virtual_account_number"),
	CONSTRAINT "traders_phone_e164" CHECK ("traders"."phone" ~ '^\+[1-9][0-9]{7,14}$'),
	CONSTRAINT "traders_pin_attempts_nonneg" CHECK ("traders"."pin_failed_attempts" >= 0)
);
--> statement-breakpoint
ALTER TABLE "credit_lines" ADD CONSTRAINT "credit_lines_trader_id_traders_id_fk" FOREIGN KEY ("trader_id") REFERENCES "public"."traders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "debts" ADD CONSTRAINT "debts_trader_id_traders_id_fk" FOREIGN KEY ("trader_id") REFERENCES "public"."traders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drawdowns" ADD CONSTRAINT "drawdowns_trader_id_traders_id_fk" FOREIGN KEY ("trader_id") REFERENCES "public"."traders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drawdowns" ADD CONSTRAINT "drawdowns_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_trader_id_traders_id_fk" FOREIGN KEY ("trader_id") REFERENCES "public"."traders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_accounts" ADD CONSTRAINT "ledger_accounts_owner_id_traders_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."traders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outbox_events" ADD CONSTRAINT "outbox_events_trader_id_traders_id_fk" FOREIGN KEY ("trader_id") REFERENCES "public"."traders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "postings" ADD CONSTRAINT "postings_entry_id_journal_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."journal_entries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "postings" ADD CONSTRAINT "postings_account_id_ledger_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."ledger_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "postings" ADD CONSTRAINT "postings_trader_id_traders_id_fk" FOREIGN KEY ("trader_id") REFERENCES "public"."traders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_trader_id_traders_id_fk" FOREIGN KEY ("trader_id") REFERENCES "public"."traders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "drawdowns_trader_status_idx" ON "drawdowns" USING btree ("trader_id","status");--> statement-breakpoint
CREATE INDEX "journal_entries_trader_idx" ON "journal_entries" USING btree ("trader_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "ledger_accounts_owner_type_uq" ON "ledger_accounts" USING btree ("owner_id","type") WHERE "ledger_accounts"."owner_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "ledger_accounts_system_type_uq" ON "ledger_accounts" USING btree ("type") WHERE "ledger_accounts"."owner_type" = 'system';--> statement-breakpoint
CREATE INDEX "outbox_undelivered_idx" ON "outbox_events" USING btree ("id") WHERE "outbox_events"."delivered_at" IS NULL;--> statement-breakpoint
CREATE INDEX "postings_account_idx" ON "postings" USING btree ("account_id","id");--> statement-breakpoint
CREATE INDEX "postings_entry_idx" ON "postings" USING btree ("entry_id");--> statement-breakpoint
CREATE INDEX "postings_trader_idx" ON "postings" USING btree ("trader_id","id");