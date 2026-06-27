DROP INDEX "quotes_quote_id_idx";--> statement-breakpoint
DROP INDEX "receipts_receipt_id_idx";--> statement-breakpoint
CREATE UNIQUE INDEX "quotes_action_quote_id_idx" ON "quotes" USING btree ("action_id","quote_id");--> statement-breakpoint
CREATE UNIQUE INDEX "receipts_action_receipt_id_idx" ON "receipts" USING btree ("action_id","receipt_id");--> statement-breakpoint
CREATE INDEX "quotes_quote_id_idx" ON "quotes" USING btree ("quote_id");--> statement-breakpoint
CREATE INDEX "receipts_receipt_id_idx" ON "receipts" USING btree ("receipt_id");