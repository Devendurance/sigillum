ALTER TABLE "payment_events" ADD COLUMN "settlement_status" text;--> statement-breakpoint
ALTER TABLE "payment_events" ADD COLUMN "settlement_scope" text;--> statement-breakpoint
ALTER TABLE "payment_events" ADD COLUMN "settlement_source" text;--> statement-breakpoint
ALTER TABLE "payment_events" ADD COLUMN "transaction_confirmed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "payment_events" ADD COLUMN "gateway_transfer_json" jsonb;--> statement-breakpoint
ALTER TABLE "payment_events" ADD COLUMN "batch_reference" text;--> statement-breakpoint
ALTER TABLE "payment_events" ADD COLUMN "settlement_last_checked_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "payment_events_settlement_status_idx" ON "payment_events" USING btree ("settlement_status");--> statement-breakpoint
CREATE INDEX "payment_events_batch_reference_idx" ON "payment_events" USING btree ("batch_reference");