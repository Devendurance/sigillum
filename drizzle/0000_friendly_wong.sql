CREATE TABLE "action_events" (
	"id" uuid PRIMARY KEY NOT NULL,
	"action_id" uuid NOT NULL,
	"stage" text NOT NULL,
	"payment_event_id" uuid,
	"inspection_id" uuid,
	"receipt_row_id" uuid,
	"agent_decision_id" uuid,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "actions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"public_id" text NOT NULL,
	"agent_id" uuid NOT NULL,
	"action_type" text NOT NULL,
	"current_stage" text NOT NULL,
	"idempotency_key" text,
	"repo" text,
	"branch" text,
	"commit_sha" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_decisions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"action_id" uuid NOT NULL,
	"receipt_row_id" uuid NOT NULL,
	"decision" text NOT NULL,
	"reason" text NOT NULL,
	"next_action" text NOT NULL,
	"policy_matched" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agents" (
	"id" uuid PRIMARY KEY NOT NULL,
	"public_id" text NOT NULL,
	"external_agent_id" text,
	"name" text NOT NULL,
	"type" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inspections" (
	"id" uuid PRIMARY KEY NOT NULL,
	"action_id" uuid NOT NULL,
	"quote_row_id" uuid,
	"status" text NOT NULL,
	"inspected_units" jsonb NOT NULL,
	"source_hash" text NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_events" (
	"id" uuid PRIMARY KEY NOT NULL,
	"action_id" uuid NOT NULL,
	"quote_row_id" uuid,
	"stage" text NOT NULL,
	"mode" text NOT NULL,
	"rail" text NOT NULL,
	"amount" text NOT NULL,
	"payment_reference" text,
	"verification_outcome" text,
	"requirement" jsonb,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quotes" (
	"id" uuid PRIMARY KEY NOT NULL,
	"action_id" uuid NOT NULL,
	"quote_id" text NOT NULL,
	"currency" text NOT NULL,
	"amount" text NOT NULL,
	"inspected_units" jsonb NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "receipts" (
	"id" uuid PRIMARY KEY NOT NULL,
	"action_id" uuid NOT NULL,
	"inspection_id" uuid NOT NULL,
	"receipt_id" text NOT NULL,
	"receipt_json" jsonb NOT NULL,
	"score" integer NOT NULL,
	"recommendation" text NOT NULL,
	"paid_amount_usdc" text NOT NULL,
	"inspected_units" jsonb NOT NULL,
	"findings" jsonb NOT NULL,
	"receipt_timestamp" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "action_events" ADD CONSTRAINT "action_events_action_id_actions_id_fk" FOREIGN KEY ("action_id") REFERENCES "public"."actions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "action_events" ADD CONSTRAINT "action_events_payment_event_id_payment_events_id_fk" FOREIGN KEY ("payment_event_id") REFERENCES "public"."payment_events"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "action_events" ADD CONSTRAINT "action_events_inspection_id_inspections_id_fk" FOREIGN KEY ("inspection_id") REFERENCES "public"."inspections"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "action_events" ADD CONSTRAINT "action_events_receipt_row_id_receipts_id_fk" FOREIGN KEY ("receipt_row_id") REFERENCES "public"."receipts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "action_events" ADD CONSTRAINT "action_events_agent_decision_id_agent_decisions_id_fk" FOREIGN KEY ("agent_decision_id") REFERENCES "public"."agent_decisions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "actions" ADD CONSTRAINT "actions_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_decisions" ADD CONSTRAINT "agent_decisions_action_id_actions_id_fk" FOREIGN KEY ("action_id") REFERENCES "public"."actions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_decisions" ADD CONSTRAINT "agent_decisions_receipt_row_id_receipts_id_fk" FOREIGN KEY ("receipt_row_id") REFERENCES "public"."receipts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inspections" ADD CONSTRAINT "inspections_action_id_actions_id_fk" FOREIGN KEY ("action_id") REFERENCES "public"."actions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inspections" ADD CONSTRAINT "inspections_quote_row_id_quotes_id_fk" FOREIGN KEY ("quote_row_id") REFERENCES "public"."quotes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_events" ADD CONSTRAINT "payment_events_action_id_actions_id_fk" FOREIGN KEY ("action_id") REFERENCES "public"."actions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_events" ADD CONSTRAINT "payment_events_quote_row_id_quotes_id_fk" FOREIGN KEY ("quote_row_id") REFERENCES "public"."quotes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_action_id_actions_id_fk" FOREIGN KEY ("action_id") REFERENCES "public"."actions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_action_id_actions_id_fk" FOREIGN KEY ("action_id") REFERENCES "public"."actions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_inspection_id_inspections_id_fk" FOREIGN KEY ("inspection_id") REFERENCES "public"."inspections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "action_events_action_id_idx" ON "action_events" USING btree ("action_id");--> statement-breakpoint
CREATE INDEX "action_events_stage_idx" ON "action_events" USING btree ("stage");--> statement-breakpoint
CREATE UNIQUE INDEX "actions_public_id_idx" ON "actions" USING btree ("public_id");--> statement-breakpoint
CREATE INDEX "actions_idempotency_key_idx" ON "actions" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "actions_agent_id_idx" ON "actions" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "actions_current_stage_idx" ON "actions" USING btree ("current_stage");--> statement-breakpoint
CREATE INDEX "agent_decisions_action_id_idx" ON "agent_decisions" USING btree ("action_id");--> statement-breakpoint
CREATE UNIQUE INDEX "agents_public_id_idx" ON "agents" USING btree ("public_id");--> statement-breakpoint
CREATE INDEX "agents_external_agent_id_idx" ON "agents" USING btree ("external_agent_id");--> statement-breakpoint
CREATE INDEX "inspections_action_id_idx" ON "inspections" USING btree ("action_id");--> statement-breakpoint
CREATE INDEX "payment_events_action_id_idx" ON "payment_events" USING btree ("action_id");--> statement-breakpoint
CREATE INDEX "payment_events_quote_row_id_idx" ON "payment_events" USING btree ("quote_row_id");--> statement-breakpoint
CREATE INDEX "payment_events_payment_reference_idx" ON "payment_events" USING btree ("payment_reference");--> statement-breakpoint
CREATE UNIQUE INDEX "quotes_quote_id_idx" ON "quotes" USING btree ("quote_id");--> statement-breakpoint
CREATE INDEX "quotes_action_id_idx" ON "quotes" USING btree ("action_id");--> statement-breakpoint
CREATE UNIQUE INDEX "receipts_receipt_id_idx" ON "receipts" USING btree ("receipt_id");--> statement-breakpoint
CREATE INDEX "receipts_action_id_idx" ON "receipts" USING btree ("action_id");