ALTER TABLE "payment_events" ADD COLUMN "transaction_hash" text;--> statement-breakpoint
CREATE INDEX "payment_events_transaction_hash_idx" ON "payment_events" USING btree ("transaction_hash");