import { randomUUID } from "node:crypto";
import { relations } from "drizzle-orm";
import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import type { SigillumActionInputSummary } from "@/lib/sigillum/lifecycle";
import type { InspectedUnits, SigillumReceipt } from "@/lib/sigillum/types";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
};

export const agents = pgTable(
  "agents",
  {
    id: uuid("id").primaryKey().$defaultFn(() => randomUUID()),
    publicId: text("public_id").notNull(),
    externalAgentId: text("external_agent_id"),
    name: text("name").notNull(),
    type: text("type"),
    ...timestamps,
  },
  (table) => ({
    publicIdIdx: uniqueIndex("agents_public_id_idx").on(table.publicId),
    externalAgentIdx: index("agents_external_agent_id_idx").on(table.externalAgentId),
  }),
);

export const actions = pgTable(
  "actions",
  {
    id: uuid("id").primaryKey().$defaultFn(() => randomUUID()),
    publicId: text("public_id").notNull(),
    agentId: uuid("agent_id")
      .notNull()
      .references(() => agents.id, { onDelete: "restrict" }),
    actionType: text("action_type").notNull(),
    currentStage: text("current_stage").notNull(),
    idempotencyKey: text("idempotency_key"),
    actionInputSummary: jsonb("action_input_summary").$type<SigillumActionInputSummary | null>(),
    repo: text("repo"),
    branch: text("branch"),
    commitSha: text("commit_sha"),
    ...timestamps,
  },
  (table) => ({
    publicIdIdx: uniqueIndex("actions_public_id_idx").on(table.publicId),
    idempotencyIdx: index("actions_idempotency_key_idx").on(table.idempotencyKey),
    agentIdx: index("actions_agent_id_idx").on(table.agentId),
    currentStageIdx: index("actions_current_stage_idx").on(table.currentStage),
  }),
);

export const quotes = pgTable(
  "quotes",
  {
    id: uuid("id").primaryKey().$defaultFn(() => randomUUID()),
    actionId: uuid("action_id")
      .notNull()
      .references(() => actions.id, { onDelete: "cascade" }),
    quoteId: text("quote_id").notNull(),
    currency: text("currency").notNull(),
    amount: text("amount").notNull(),
    inspectedUnits: jsonb("inspected_units").$type<InspectedUnits>().notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    quoteIdIdx: index("quotes_quote_id_idx").on(table.quoteId),
    actionQuoteIdx: uniqueIndex("quotes_action_quote_id_idx").on(table.actionId, table.quoteId),
    actionIdx: index("quotes_action_id_idx").on(table.actionId),
  }),
);

export const paymentEvents = pgTable(
  "payment_events",
  {
    id: uuid("id").primaryKey().$defaultFn(() => randomUUID()),
    actionId: uuid("action_id")
      .notNull()
      .references(() => actions.id, { onDelete: "cascade" }),
    quoteRowId: uuid("quote_row_id").references(() => quotes.id, { onDelete: "set null" }),
    stage: text("stage").notNull(),
    mode: text("mode").notNull(),
    rail: text("rail").notNull(),
    amount: text("amount").notNull(),
    paymentReference: text("payment_reference"),
    transactionHash: text("transaction_hash"),
    settlementStatus: text("settlement_status"),
    settlementScope: text("settlement_scope"),
    settlementSource: text("settlement_source"),
    transactionConfirmedAt: timestamp("transaction_confirmed_at", { withTimezone: true }),
    gatewayTransferJson: jsonb("gateway_transfer_json").$type<Record<string, unknown> | null>(),
    batchReference: text("batch_reference"),
    settlementLastCheckedAt: timestamp("settlement_last_checked_at", { withTimezone: true }),
    verificationOutcome: text("verification_outcome"),
    requirement: jsonb("requirement").$type<Record<string, unknown> | null>(),
    metadata: jsonb("metadata").$type<Record<string, unknown> | null>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    actionIdx: index("payment_events_action_id_idx").on(table.actionId),
    quoteIdx: index("payment_events_quote_row_id_idx").on(table.quoteRowId),
    paymentRefIdx: index("payment_events_payment_reference_idx").on(table.paymentReference),
    transactionHashIdx: index("payment_events_transaction_hash_idx").on(table.transactionHash),
    settlementStatusIdx: index("payment_events_settlement_status_idx").on(table.settlementStatus),
    batchReferenceIdx: index("payment_events_batch_reference_idx").on(table.batchReference),
  }),
);

export const inspections = pgTable(
  "inspections",
  {
    id: uuid("id").primaryKey().$defaultFn(() => randomUUID()),
    actionId: uuid("action_id")
      .notNull()
      .references(() => actions.id, { onDelete: "cascade" }),
    quoteRowId: uuid("quote_row_id").references(() => quotes.id, { onDelete: "set null" }),
    status: text("status").notNull(),
    inspectedUnits: jsonb("inspected_units").$type<InspectedUnits>().notNull(),
    sourceHash: text("source_hash").notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    actionIdx: index("inspections_action_id_idx").on(table.actionId),
  }),
);

export const receipts = pgTable(
  "receipts",
  {
    id: uuid("id").primaryKey().$defaultFn(() => randomUUID()),
    actionId: uuid("action_id")
      .notNull()
      .references(() => actions.id, { onDelete: "cascade" }),
    inspectionId: uuid("inspection_id")
      .notNull()
      .references(() => inspections.id, { onDelete: "cascade" }),
    receiptId: text("receipt_id").notNull(),
    receiptJson: jsonb("receipt_json").$type<SigillumReceipt>().notNull(),
    score: integer("score").notNull(),
    recommendation: text("recommendation").notNull(),
    paidAmountUsdc: text("paid_amount_usdc").notNull(),
    inspectedUnits: jsonb("inspected_units").$type<InspectedUnits>().notNull(),
    findings: jsonb("findings").$type<SigillumReceipt["findings"]>().notNull(),
    receiptTimestamp: timestamp("receipt_timestamp", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    receiptIdIdx: index("receipts_receipt_id_idx").on(table.receiptId),
    actionReceiptIdx: uniqueIndex("receipts_action_receipt_id_idx").on(table.actionId, table.receiptId),
    actionIdx: index("receipts_action_id_idx").on(table.actionId),
  }),
);

export const agentDecisions = pgTable(
  "agent_decisions",
  {
    id: uuid("id").primaryKey().$defaultFn(() => randomUUID()),
    actionId: uuid("action_id")
      .notNull()
      .references(() => actions.id, { onDelete: "cascade" }),
    receiptRowId: uuid("receipt_row_id")
      .notNull()
      .references(() => receipts.id, { onDelete: "cascade" }),
    decision: text("decision").notNull(),
    reason: text("reason").notNull(),
    nextAction: text("next_action").notNull(),
    policyMatched: text("policy_matched").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    actionIdx: index("agent_decisions_action_id_idx").on(table.actionId),
  }),
);

export const actionEvents = pgTable(
  "action_events",
  {
    id: uuid("id").primaryKey().$defaultFn(() => randomUUID()),
    actionId: uuid("action_id")
      .notNull()
      .references(() => actions.id, { onDelete: "cascade" }),
    stage: text("stage").notNull(),
    paymentEventId: uuid("payment_event_id").references(() => paymentEvents.id, { onDelete: "set null" }),
    inspectionId: uuid("inspection_id").references(() => inspections.id, { onDelete: "set null" }),
    receiptRowId: uuid("receipt_row_id").references(() => receipts.id, { onDelete: "set null" }),
    agentDecisionId: uuid("agent_decision_id").references(() => agentDecisions.id, {
      onDelete: "set null",
    }),
    metadata: jsonb("metadata").$type<Record<string, unknown> | null>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    actionIdx: index("action_events_action_id_idx").on(table.actionId),
    stageIdx: index("action_events_stage_idx").on(table.stage),
  }),
);

export const agentsRelations = relations(agents, ({ many }) => ({
  actions: many(actions),
}));

export const actionsRelations = relations(actions, ({ one, many }) => ({
  agent: one(agents, {
    fields: [actions.agentId],
    references: [agents.id],
  }),
  quotes: many(quotes),
  paymentEvents: many(paymentEvents),
  inspections: many(inspections),
  receipts: many(receipts),
  agentDecisions: many(agentDecisions),
  actionEvents: many(actionEvents),
}));

export const quotesRelations = relations(quotes, ({ one, many }) => ({
  action: one(actions, {
    fields: [quotes.actionId],
    references: [actions.id],
  }),
  paymentEvents: many(paymentEvents),
  inspections: many(inspections),
}));

export const paymentEventsRelations = relations(paymentEvents, ({ one }) => ({
  action: one(actions, {
    fields: [paymentEvents.actionId],
    references: [actions.id],
  }),
  quote: one(quotes, {
    fields: [paymentEvents.quoteRowId],
    references: [quotes.id],
  }),
}));

export const inspectionsRelations = relations(inspections, ({ one, many }) => ({
  action: one(actions, {
    fields: [inspections.actionId],
    references: [actions.id],
  }),
  quote: one(quotes, {
    fields: [inspections.quoteRowId],
    references: [quotes.id],
  }),
  receipts: many(receipts),
}));

export const receiptsRelations = relations(receipts, ({ one, many }) => ({
  action: one(actions, {
    fields: [receipts.actionId],
    references: [actions.id],
  }),
  inspection: one(inspections, {
    fields: [receipts.inspectionId],
    references: [inspections.id],
  }),
  decisions: many(agentDecisions),
}));

export const agentDecisionsRelations = relations(agentDecisions, ({ one }) => ({
  action: one(actions, {
    fields: [agentDecisions.actionId],
    references: [actions.id],
  }),
  receipt: one(receipts, {
    fields: [agentDecisions.receiptRowId],
    references: [receipts.id],
  }),
}));

export const actionEventsRelations = relations(actionEvents, ({ one }) => ({
  action: one(actions, {
    fields: [actionEvents.actionId],
    references: [actions.id],
  }),
  paymentEvent: one(paymentEvents, {
    fields: [actionEvents.paymentEventId],
    references: [paymentEvents.id],
  }),
  inspection: one(inspections, {
    fields: [actionEvents.inspectionId],
    references: [inspections.id],
  }),
  receipt: one(receipts, {
    fields: [actionEvents.receiptRowId],
    references: [receipts.id],
  }),
  agentDecision: one(agentDecisions, {
    fields: [actionEvents.agentDecisionId],
    references: [agentDecisions.id],
  }),
}));
