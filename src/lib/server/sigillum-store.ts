import { randomUUID } from "node:crypto";
import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import {
  actionEvents,
  actions,
  agentDecisions,
  agents,
  inspections,
  paymentEvents,
  quotes,
  receipts,
} from "../../../drizzle/schema/sigillum";
import { db } from "./db";
import type { PaymentVerificationResult } from "@/lib/sigillum/payment/types";
import type {
  AgentDecision,
  Finding,
  InspectedUnits,
  Quote,
  SigillumLiveActionLifecycleEvent,
  SigillumLiveActionRow,
  SigillumPublicReceipt,
  SigillumReceipt,
} from "@/lib/sigillum/types";
import {
  maxSigillumActionStage,
  type SigillumActionInputSummary,
  type SigillumActionEnvelope,
  type SigillumActionType,
  type SigillumActionStage,
} from "@/lib/sigillum/lifecycle";
import type {
  PaymentRail,
  SigillumPaymentMode,
  SigillumSettlementProof,
  SigillumSettlementScope,
  SigillumSettlementSource,
  SigillumSettlementStatus,
} from "@/lib/sigillum/payment/types";
import { createSigillumReceiptHash } from "@/lib/sigillum/receipt-hash";
import { formatSigillumNetworkLabel } from "@/lib/sigillum/arcscan";
import { getSigillumX402Network } from "@/lib/sigillum/payment/config";
import {
  isExplorerTransactionHash,
  resolveSigillumSettlementProof,
} from "./sigillum-payment-provenance";
import {
  createActionInputSummary,
  createActionSourceHash,
  createSafeActionSummary,
} from "@/lib/sigillum/action-utils";

type AgentRow = typeof agents.$inferSelect;
type ActionRow = typeof actions.$inferSelect;
type QuoteRow = typeof quotes.$inferSelect;
type InspectionRow = typeof inspections.$inferSelect;

export async function upsertAgentFromEnvelope(envelope: SigillumActionEnvelope) {
  if (envelope.agent.id) {
    const existing = await db.query.agents.findFirst({
      where: eq(agents.externalAgentId, envelope.agent.id),
    });

    if (existing) {
      const [updated] = await db
        .update(agents)
        .set({
          name: envelope.agent.name,
          type: envelope.agent.type ?? null,
          updatedAt: new Date(),
        })
        .where(eq(agents.id, existing.id))
        .returning();

      return updated;
    }
  }

  const [created] = await db
    .insert(agents)
    .values({
      publicId: createPublicId("agt"),
      externalAgentId: envelope.agent.id ?? null,
      name: envelope.agent.name,
      type: envelope.agent.type ?? null,
    })
    .returning();

  return created;
}

export async function createActionForQuote({
  agent,
  envelope,
}: {
  agent: AgentRow;
  envelope: SigillumActionEnvelope;
}) {
  if (envelope.idempotency_key) {
    const existing = await db.query.actions.findFirst({
      where: eq(actions.idempotencyKey, envelope.idempotency_key),
    });

    if (existing) {
      const existingQuote = await db.query.quotes.findFirst({
        where: eq(quotes.actionId, existing.id),
      });

      return { action: existing, quote: existingQuote ?? null };
    }
  }

  const [action] = await db
    .insert(actions)
    .values({
      publicId: createPublicId("act"),
      agentId: agent.id,
      actionType: envelope.action_type,
      currentStage: "action_submitted",
      idempotencyKey: envelope.idempotency_key ?? null,
      actionInputSummary: createActionInputSummary(envelope),
      repo: envelope.action_type === "code_change" ? envelope.action_input.repo ?? null : null,
      branch: envelope.action_type === "code_change" ? envelope.action_input.branch ?? null : null,
      commitSha:
        envelope.action_type === "code_change"
          ? envelope.action_input.commit_sha ?? null
          : envelope.action_type === "deploy_action"
            ? envelope.action_input.commit_sha ?? null
            : null,
    })
    .returning();

  return { action, quote: null };
}

export async function createQuoteForAction({
  action,
  quote,
}: {
  action: ActionRow;
  quote: Quote;
}) {
  const existing = await db.query.quotes.findFirst({
    where: and(eq(quotes.actionId, action.id), eq(quotes.quoteId, quote.quote_id)),
  });

  if (existing) {
    return existing;
  }

  const [created] = await db
    .insert(quotes)
    .values({
      actionId: action.id,
      quoteId: quote.quote_id,
      currency: quote.currency,
      amount: quote.amount,
      inspectedUnits: quote.inspected_units,
      expiresAt: new Date(quote.expires_at),
    })
    .returning();

  return created;
}

export async function recordActionEvent({
  actionId,
  stage,
  paymentEventId,
  inspectionId,
  receiptRowId,
  agentDecisionId,
  metadata,
}: {
  actionId: string;
  stage: SigillumActionStage;
  paymentEventId?: string;
  inspectionId?: string;
  receiptRowId?: string;
  agentDecisionId?: string;
  metadata?: Record<string, unknown>;
}) {
  const [created] = await db
    .insert(actionEvents)
    .values({
      actionId,
      stage,
      paymentEventId: paymentEventId ?? null,
      inspectionId: inspectionId ?? null,
      receiptRowId: receiptRowId ?? null,
      agentDecisionId: agentDecisionId ?? null,
      metadata: metadata ?? null,
    })
    .returning();

  const existingAction = await db.query.actions.findFirst({
    where: eq(actions.id, actionId),
    columns: {
      currentStage: true,
    },
  });

  await db
    .update(actions)
    .set({
      currentStage: existingAction
        ? maxSigillumActionStage(existingAction.currentStage as SigillumActionStage, stage)
        : stage,
      updatedAt: new Date(),
    })
    .where(eq(actions.id, actionId));

  return created;
}

export async function recordPaymentRequired({
  action,
  quote,
  verification,
}: {
  action: ActionRow;
  quote: QuoteRow;
  verification: Extract<PaymentVerificationResult, { ok: false }>;
}) {
  const existing = await db.query.paymentEvents.findFirst({
    where: and(
      eq(paymentEvents.actionId, action.id),
      eq(paymentEvents.quoteRowId, quote.id),
      eq(paymentEvents.stage, "payment_required"),
      eq(paymentEvents.mode, verification.mode),
      eq(paymentEvents.rail, verification.rail),
      eq(paymentEvents.verificationOutcome, verification.reason),
    ),
    orderBy: [desc(paymentEvents.createdAt)],
  });

  if (existing) {
    return existing;
  }

  const [paymentEvent] = await db
    .insert(paymentEvents)
    .values({
      actionId: action.id,
      quoteRowId: quote.id,
      stage: "payment_required",
      mode: verification.mode,
      rail: verification.rail,
      amount: verification.requirement.amount,
      paymentReference: null,
      verificationOutcome: verification.reason,
      requirement: verification.requirement as Record<string, unknown>,
      metadata: verification.response_headers
        ? {
            response_headers: verification.response_headers,
          }
        : null,
    })
    .returning();

  await recordActionEvent({
    actionId: action.id,
    stage: "payment_required",
    paymentEventId: paymentEvent.id,
    metadata: {
      quote_id: quote.quoteId,
      mode: verification.mode,
      rail: verification.rail,
    },
  });

  return paymentEvent;
}

export async function recordPaymentConfirmed({
  action,
  quote,
  verification,
}: {
  action: ActionRow;
  quote: QuoteRow;
  verification: Extract<PaymentVerificationResult, { ok: true }>;
}) {
  const existing = await db.query.paymentEvents.findFirst({
    where: and(
      eq(paymentEvents.actionId, action.id),
      eq(paymentEvents.quoteRowId, quote.id),
      eq(paymentEvents.stage, "payment_confirmed"),
      eq(paymentEvents.paymentReference, verification.payment_reference),
    ),
  });

  if (existing) {
    return existing;
  }

  const [paymentEvent] = await db
    .insert(paymentEvents)
    .values({
      actionId: action.id,
      quoteRowId: quote.id,
      stage: "payment_confirmed",
      mode: verification.mode,
      rail: verification.rail,
      amount: quote.amount,
      paymentReference: verification.payment_reference,
      transactionHash: isExplorerTransactionHash(verification.payment_reference)
        ? verification.payment_reference
        : null,
      settlementStatus: isExplorerTransactionHash(verification.payment_reference)
        ? "completed"
        : "gateway_received",
      settlementScope: isExplorerTransactionHash(verification.payment_reference)
        ? "individual"
        : "unknown",
      settlementSource: isExplorerTransactionHash(verification.payment_reference)
        ? "gateway_api"
        : null,
      transactionConfirmedAt: isExplorerTransactionHash(verification.payment_reference)
        ? new Date()
        : null,
      gatewayTransferJson: null,
      batchReference: null,
      settlementLastCheckedAt: new Date(),
      verificationOutcome: "settled",
      requirement: null,
      metadata: verification.response_headers
        ? {
            response_headers: verification.response_headers,
          }
        : null,
    })
    .returning();

  await recordActionEvent({
    actionId: action.id,
    stage: "payment_confirmed",
    paymentEventId: paymentEvent.id,
    metadata: {
      quote_id: quote.quoteId,
      payment_reference: verification.payment_reference,
    },
  });

  return paymentEvent;
}

export async function reconcilePaymentEventSettlementProof(
  paymentEventId: string,
  source: SigillumSettlementSource = "gateway_api",
) {
  const paymentEvent = await db.query.paymentEvents.findFirst({
    where: eq(paymentEvents.id, paymentEventId),
  });

  if (!paymentEvent?.paymentReference) {
    return null;
  }

  const proof = await resolveSigillumSettlementProof({
    paymentReference: paymentEvent.paymentReference,
    source,
  });

  const [updated] = await db
    .update(paymentEvents)
    .set({
      transactionHash: proof.transaction_hash,
      settlementStatus: proof.settlement_status,
      settlementScope: proof.settlement_scope,
      settlementSource: proof.settlement_source,
      transactionConfirmedAt: proof.transaction_confirmed_at
        ? new Date(proof.transaction_confirmed_at)
        : null,
      gatewayTransferJson: proof.gateway_transfer_json,
      batchReference: proof.batch_reference,
      settlementLastCheckedAt: new Date(proof.settlement_last_checked_at),
    })
    .where(eq(paymentEvents.id, paymentEventId))
    .returning();

  return toSettlementProof(updated ?? paymentEvent, proof);
}

export async function createInspection({
  action,
  quote,
  inspectedUnits,
  envelope,
}: {
  action: ActionRow;
  quote: QuoteRow;
  inspectedUnits: InspectedUnits;
  envelope: SigillumActionEnvelope;
}) {
  const [inspection] = await db
    .insert(inspections)
    .values({
      actionId: action.id,
      quoteRowId: quote.id,
      status: "inspection_running",
      inspectedUnits,
      sourceHash: createActionSourceHash(envelope),
    })
    .returning();

  await recordActionEvent({
    actionId: action.id,
    stage: "inspection_running",
    inspectionId: inspection.id,
    metadata: {
      quote_id: quote.quoteId,
    },
  });

  return inspection;
}

export async function storeReceiptAndDecision({
  action,
  inspection,
  receipt,
  agentDecision,
}: {
  action: ActionRow;
  inspection: InspectionRow;
  receipt: SigillumReceipt;
  agentDecision: AgentDecision;
}) {
  const [receiptRow] = await db
    .insert(receipts)
    .values({
      actionId: action.id,
      inspectionId: inspection.id,
      receiptId: receipt.receipt_id,
      receiptJson: receipt,
      score: receipt.score,
      recommendation: receipt.recommendation,
      paidAmountUsdc: receipt.paid_amount_usdc,
      inspectedUnits: receipt.inspected_units,
      findings: receipt.findings,
      receiptTimestamp: new Date(receipt.timestamp),
    })
    .returning();

  await db
    .update(inspections)
    .set({
      status: "completed",
      completedAt: new Date(receipt.timestamp),
    })
    .where(eq(inspections.id, inspection.id));

  await recordActionEvent({
    actionId: action.id,
    stage: "receipt_generated",
    inspectionId: inspection.id,
    receiptRowId: receiptRow.id,
    metadata: {
      receipt_id: receipt.receipt_id,
      recommendation: receipt.recommendation,
      score: receipt.score,
    },
  });

  const [decisionRow] = await db
    .insert(agentDecisions)
    .values({
      actionId: action.id,
      receiptRowId: receiptRow.id,
      decision: agentDecision.agent_decision,
      reason: agentDecision.reason,
      nextAction: agentDecision.next_action,
      policyMatched: agentDecision.policy_matched,
    })
    .returning();

  await recordActionEvent({
    actionId: action.id,
    stage: "agent_decision_created",
    receiptRowId: receiptRow.id,
    agentDecisionId: decisionRow.id,
    metadata: {
      decision: agentDecision.agent_decision,
      policy_matched: agentDecision.policy_matched,
    },
  });

  return { receiptRow, decisionRow };
}

export async function findCompletedOutcome(actionId: string): Promise<{
  receipt: SigillumReceipt;
  agentDecision: AgentDecision;
  payment: {
    mode: SigillumPaymentMode;
    rail: PaymentRail;
    payment_reference: string | undefined;
    transaction_hash: string | undefined;
    settlement_status: SigillumSettlementStatus | null;
    settlement_scope: SigillumSettlementScope | null;
    settlement_source: SigillumSettlementSource | null;
    transaction_confirmed_at: string | null;
    batch_reference: string | null;
  } | null;
} | null> {
  const receiptRow = await db.query.receipts.findFirst({
    where: eq(receipts.actionId, actionId),
    orderBy: [desc(receipts.createdAt)],
  });

  if (!receiptRow) {
    return null;
  }

  const decisionRow = await db.query.agentDecisions.findFirst({
    where: eq(agentDecisions.actionId, actionId),
    orderBy: [desc(agentDecisions.createdAt)],
  });

  if (!decisionRow) {
    return null;
  }

  const paymentRow = await db.query.paymentEvents.findFirst({
    where: and(
      eq(paymentEvents.actionId, actionId),
      eq(paymentEvents.stage, "payment_confirmed"),
    ),
    orderBy: [desc(paymentEvents.createdAt)],
  });

  const resolvedPaymentRow =
    paymentRow && shouldRefreshSettlementProof(paymentRow)
      ? await refreshPaymentRow(paymentRow.id)
      : paymentRow;

  const payment =
    resolvedPaymentRow &&
    (resolvedPaymentRow.mode === "demo" || resolvedPaymentRow.mode === "x402") &&
    (resolvedPaymentRow.rail === "local-demo" || resolvedPaymentRow.rail === "x402")
      ? {
          mode: resolvedPaymentRow.mode as SigillumPaymentMode,
          rail: resolvedPaymentRow.rail as PaymentRail,
          payment_reference: resolvedPaymentRow.paymentReference ?? undefined,
          transaction_hash: resolvedPaymentRow.transactionHash ?? undefined,
          settlement_status: normalizeSettlementStatus(resolvedPaymentRow.settlementStatus),
          settlement_scope: normalizeSettlementScope(resolvedPaymentRow.settlementScope),
          settlement_source: normalizeSettlementSource(resolvedPaymentRow.settlementSource),
          transaction_confirmed_at: resolvedPaymentRow.transactionConfirmedAt?.toISOString() ?? null,
          batch_reference: resolvedPaymentRow.batchReference ?? null,
        }
      : null;

  return {
    receipt: receiptRow.receiptJson,
    agentDecision: {
      agent_decision: decisionRow.decision as AgentDecision["agent_decision"],
      reason: decisionRow.reason,
      next_action: decisionRow.nextAction,
      policy_matched: decisionRow.policyMatched,
    },
    payment,
  };
}

export async function findActionByPublicId(publicId: string) {
  return db.query.actions.findFirst({
    where: eq(actions.publicId, publicId),
  });
}

export async function findQuoteByQuoteId(quoteId: string) {
  return db.query.quotes.findFirst({
    where: eq(quotes.quoteId, quoteId),
  });
}

export async function findQuoteForAction({
  actionId,
  quoteId,
}: {
  actionId: string;
  quoteId: string;
}) {
  return db.query.quotes.findFirst({
    where: and(eq(quotes.actionId, actionId), eq(quotes.quoteId, quoteId)),
  });
}

export async function listLiveActions(): Promise<SigillumLiveActionRow[]> {
  const rows = await db
    .select({
      actionId: actions.publicId,
      actionRowId: actions.id,
      actionType: actions.actionType,
      actionInputSummary: actions.actionInputSummary,
      currentStage: actions.currentStage,
      timestamp: actions.createdAt,
      agentName: agents.name,
      agentPublicId: agents.publicId,
      agentId: agents.externalAgentId,
      amount: quotes.amount,
      inspectedUnits: receipts.inspectedUnits,
      quoteInspectedUnits: quotes.inspectedUnits,
      receiptId: receipts.receiptId,
      recommendation: receipts.recommendation,
      riskScore: receipts.score,
      findings: receipts.findings,
      decision: agentDecisions.decision,
    })
    .from(actions)
    .innerJoin(agents, eq(actions.agentId, agents.id))
    .leftJoin(quotes, eq(quotes.actionId, actions.id))
    .leftJoin(receipts, eq(receipts.actionId, actions.id))
    .leftJoin(agentDecisions, eq(agentDecisions.actionId, actions.id))
    .orderBy(desc(actions.createdAt))
    .limit(50);

  const actionIds = rows.map((row) => row.actionRowId);
  const payments =
    actionIds.length > 0
      ? await db
          .select({
            actionId: paymentEvents.actionId,
            rail: paymentEvents.rail,
            paymentReference: paymentEvents.paymentReference,
            transactionHash: paymentEvents.transactionHash,
            settlementStatus: paymentEvents.settlementStatus,
            settlementScope: paymentEvents.settlementScope,
            settlementSource: paymentEvents.settlementSource,
            transactionConfirmedAt: paymentEvents.transactionConfirmedAt,
            batchReference: paymentEvents.batchReference,
            createdAt: paymentEvents.createdAt,
          })
          .from(paymentEvents)
          .where(inArray(paymentEvents.actionId, actionIds))
          .orderBy(desc(paymentEvents.createdAt))
      : [];

  const inspectionRows =
    actionIds.length > 0
      ? await db
          .select({
            actionId: inspections.actionId,
            sourceHash: inspections.sourceHash,
            createdAt: inspections.createdAt,
          })
          .from(inspections)
          .where(inArray(inspections.actionId, actionIds))
          .orderBy(desc(inspections.createdAt))
      : [];

  const lifecycleRows =
    actionIds.length > 0
      ? await db.query.actionEvents.findMany({
          where: inArray(actionEvents.actionId, actionIds),
          orderBy: [desc(actionEvents.createdAt)],
        })
      : [];

  const latestPaymentByAction = new Map<
    string,
    {
      transactionHash: string | null;
      paymentReference: string | null;
      rail: PaymentRail | null;
      settlementStatus: SigillumSettlementStatus | null;
      settlementScope: SigillumSettlementScope | null;
      settlementSource: SigillumSettlementSource | null;
      transactionConfirmedAt: string | null;
      batchReference: string | null;
    }
  >();
  for (const payment of payments) {
    if (!latestPaymentByAction.has(payment.actionId)) {
      const normalizedReference = payment.paymentReference ?? null;
      latestPaymentByAction.set(payment.actionId, {
        transactionHash: payment.transactionHash ?? null,
        paymentReference: normalizedReference,
        rail:
          payment.rail === "local-demo" || payment.rail === "x402"
            ? payment.rail
            : null,
        settlementStatus: normalizeSettlementStatus(payment.settlementStatus),
        settlementScope: normalizeSettlementScope(payment.settlementScope),
        settlementSource: normalizeSettlementSource(payment.settlementSource),
        transactionConfirmedAt: payment.transactionConfirmedAt?.toISOString() ?? null,
        batchReference: payment.batchReference ?? null,
      });
    }
  }

  const latestInspectionByAction = new Map<string, string | null>();
  for (const inspection of inspectionRows) {
    if (!latestInspectionByAction.has(inspection.actionId)) {
      latestInspectionByAction.set(inspection.actionId, inspection.sourceHash);
    }
  }

  const paymentEventIds = lifecycleRows
    .map((row) => row.paymentEventId)
    .filter((value): value is string => typeof value === "string");
  const paymentEventRows =
    paymentEventIds.length > 0
      ? await db.query.paymentEvents.findMany({
          where: inArray(paymentEvents.id, paymentEventIds),
        })
      : [];
  const paymentEventById = new Map(paymentEventRows.map((row) => [row.id, row]));

  const lifecycleByAction = new Map<string, SigillumLiveActionLifecycleEvent[]>();
  for (const event of [...lifecycleRows].reverse()) {
    const list = lifecycleByAction.get(event.actionId) ?? [];
    const paymentEvent =
      event.paymentEventId ? paymentEventById.get(event.paymentEventId) : undefined;
    const metadata = isPlainObject(event.metadata) ? event.metadata : null;

    list.push({
      stage: event.stage as SigillumActionStage,
      timestamp: event.createdAt.toISOString(),
      quote_id: readMetadataString(metadata, "quote_id") ?? undefined,
      amount:
        readMetadataString(metadata, "amount") ??
        paymentEvent?.amount ??
        undefined,
      payment_reference:
        paymentEvent?.paymentReference ??
        readMetadataString(metadata, "payment_reference") ??
        undefined,
      transaction_hash: paymentEvent?.transactionHash ?? undefined,
      settlement_status: normalizeSettlementStatus(paymentEvent?.settlementStatus) ?? undefined,
      settlement_scope: normalizeSettlementScope(paymentEvent?.settlementScope) ?? undefined,
      settlement_source: normalizeSettlementSource(paymentEvent?.settlementSource) ?? undefined,
      transaction_confirmed_at: paymentEvent?.transactionConfirmedAt?.toISOString() ?? undefined,
      batch_reference: paymentEvent?.batchReference ?? undefined,
      receipt_id: readMetadataString(metadata, "receipt_id") ?? undefined,
      decision: readMetadataDecision(metadata, "decision") ?? undefined,
    });
    lifecycleByAction.set(event.actionId, list);
  }

  const network = formatSigillumNetworkLabel(getSigillumX402Network());

  return rows.map((row) => {
    const findings = Array.isArray(row.findings) ? (row.findings as Finding[]) : [];
    const findingsCategories = [...new Set(findings.map((finding) => finding.category).filter(Boolean))];
    const fileTypes = [...new Set(findings.map((finding) => toFileType(finding.file)).filter(Boolean) as string[])];
    const inspectedUnits = row.inspectedUnits ?? row.quoteInspectedUnits ?? null;
    const payment = latestPaymentByAction.get(row.actionRowId);

    return {
      action_id: row.actionId,
      agent_id: row.agentId ?? row.agentPublicId,
      agent_name: row.agentName,
      action_type: row.actionType as SigillumActionType,
      current_stage: row.currentStage as SigillumActionStage,
      amount: row.amount,
      rail: payment?.rail ?? null,
      network: payment?.rail === "x402" ? network : null,
      transaction_hash: payment?.transactionHash ?? null,
      payment_reference: payment?.paymentReference ?? null,
      settlement_status: payment?.settlementStatus ?? null,
      settlement_scope: payment?.settlementScope ?? null,
      settlement_source: payment?.settlementSource ?? null,
      transaction_confirmed_at: payment?.transactionConfirmedAt ?? null,
      batch_reference: payment?.batchReference ?? null,
      risk_score: row.riskScore,
      recommendation:
        row.recommendation === "pass" || row.recommendation === "warn" || row.recommendation === "block"
          ? row.recommendation
          : null,
      receipt_id: row.receiptId,
      agent_decision:
        row.decision === "continue_merge" ||
        row.decision === "request_patch" ||
        row.decision === "stop_merge"
          ? row.decision
          : null,
      source_hash: latestInspectionByAction.get(row.actionRowId) ?? null,
      inspected_units: inspectedUnits,
      findings_categories: findingsCategories,
      file_types: fileTypes,
      safe_summary: createSafeActionSummary({
        actionType: row.actionType as SigillumActionType,
        actionInputSummary: (row.actionInputSummary as SigillumActionInputSummary | null) ?? null,
        inspectedUnits,
        findingsCategories,
        sourceHash: latestInspectionByAction.get(row.actionRowId) ?? null,
      }),
      timestamp: row.timestamp.toISOString(),
      lifecycle_events: lifecycleByAction.get(row.actionRowId) ?? [],
    };
  });
}

export async function findLatestActionForAgent({
  agentName,
  actionType,
}: {
  agentName: string;
  actionType: SigillumActionType;
}) {
  return db
    .select({
      id: actions.id,
      publicId: actions.publicId,
      currentStage: actions.currentStage,
      createdAt: actions.createdAt,
    })
    .from(actions)
    .innerJoin(agents, eq(actions.agentId, agents.id))
    .where(and(eq(agents.name, agentName), eq(actions.actionType, actionType)))
    .orderBy(desc(actions.createdAt))
    .limit(1)
    .then((rows) => rows[0] ?? null);
}

export async function getSettledAgentSpendSince({
  agentName,
  startedAt,
}: {
  agentName: string;
  startedAt: Date;
}) {
  const rows = await db
    .select({
      amount: paymentEvents.amount,
      createdAt: paymentEvents.createdAt,
    })
    .from(paymentEvents)
    .innerJoin(actions, eq(paymentEvents.actionId, actions.id))
    .innerJoin(agents, eq(actions.agentId, agents.id))
    .where(
      and(
        eq(agents.name, agentName),
        eq(paymentEvents.stage, "payment_confirmed"),
      ),
    );

  let total = BigInt(0);
  const startedAtMs = startedAt.getTime();

  for (const row of rows) {
    if (row.createdAt.getTime() < startedAtMs) {
      continue;
    }
    total += toMicroUsdc(row.amount);
  }

  return fromMicroUsdc(total);
}

export async function findPublicReceiptByReceiptId(receiptId: string): Promise<SigillumPublicReceipt | null> {
  const receiptRow = await db.query.receipts.findFirst({
    where: eq(receipts.receiptId, receiptId),
    orderBy: [desc(receipts.createdAt)],
  });

  if (!receiptRow) {
    return null;
  }

  const action = await db.query.actions.findFirst({
    where: eq(actions.id, receiptRow.actionId),
  });

  if (!action) {
    return null;
  }

  const agent = await db.query.agents.findFirst({
    where: eq(agents.id, action.agentId),
  });

  if (!agent) {
    return null;
  }

  const decisionRow = await db.query.agentDecisions.findFirst({
    where: eq(agentDecisions.receiptRowId, receiptRow.id),
    orderBy: [desc(agentDecisions.createdAt)],
  });

  if (!decisionRow) {
    return null;
  }

  const paymentRow = await db.query.paymentEvents.findFirst({
    where: and(
      eq(paymentEvents.actionId, action.id),
      eq(paymentEvents.stage, "payment_confirmed"),
    ),
    orderBy: [desc(paymentEvents.createdAt)],
  });

  const resolvedPaymentRow =
    paymentRow && shouldRefreshSettlementProof(paymentRow)
      ? await refreshPaymentRow(paymentRow.id)
      : paymentRow;

  return {
    receipt_id: receiptRow.receiptId,
    action_id: action.publicId,
    agent_name: agent.name,
    action_type: action.actionType as SigillumActionType,
    risk_score: receiptRow.score,
    recommendation: receiptRow.recommendation as SigillumPublicReceipt["recommendation"],
    paid_amount_usdc: receiptRow.paidAmountUsdc,
    rail:
      resolvedPaymentRow?.rail === "local-demo" || resolvedPaymentRow?.rail === "x402"
        ? resolvedPaymentRow.rail
        : null,
    network: resolvedPaymentRow?.rail === "x402" ? formatSigillumNetworkLabel(getSigillumX402Network()) : null,
    transaction_hash: resolvedPaymentRow?.transactionHash ?? null,
    payment_reference: resolvedPaymentRow?.paymentReference ?? null,
    settlement_status: normalizeSettlementStatus(resolvedPaymentRow?.settlementStatus),
    settlement_scope: normalizeSettlementScope(resolvedPaymentRow?.settlementScope),
    settlement_source: normalizeSettlementSource(resolvedPaymentRow?.settlementSource),
    transaction_confirmed_at: resolvedPaymentRow?.transactionConfirmedAt?.toISOString() ?? null,
    batch_reference: resolvedPaymentRow?.batchReference ?? null,
    receipt_hash: createSigillumReceiptHash(receiptRow.receiptJson),
    inspected_units: receiptRow.inspectedUnits,
    findings: receiptRow.findings,
    patch_recommendation: receiptRow.receiptJson.patch_recommendation,
    agent_decision: {
      agent_decision: decisionRow.decision as AgentDecision["agent_decision"],
      reason: decisionRow.reason,
      next_action: decisionRow.nextAction,
      policy_matched: decisionRow.policyMatched,
    },
    timestamp: receiptRow.receiptTimestamp.toISOString(),
    seal: receiptRow.receiptJson.seal,
  };
}

export async function listPaymentsMissingTransactionHash() {
  return db.query.paymentEvents.findMany({
    where: and(
      eq(paymentEvents.stage, "payment_confirmed"),
      isNull(paymentEvents.transactionHash),
    ),
    orderBy: [desc(paymentEvents.createdAt)],
  });
}

export async function createInitialActionTimeline({
  action,
  quote,
}: {
  action: ActionRow;
  quote: QuoteRow;
}) {
  await recordActionEvent({
    actionId: action.id,
    stage: "action_submitted",
    metadata: {
      action_id: action.publicId,
      action_type: action.actionType,
    },
  });

  await recordActionEvent({
    actionId: action.id,
    stage: "quote_created",
    metadata: {
      quote_id: quote.quoteId,
      amount: quote.amount,
    },
  });
}

function createPublicId(prefix: "agt" | "act") {
  return `${prefix}_${randomUUID().replace(/-/g, "").slice(0, 12)}`;
}

function toFileType(filePath: string | undefined) {
  if (!filePath) {
    return null;
  }

  const match = filePath.match(/(\.[A-Za-z0-9]+)$/);
  return match ? match[1].toLowerCase() : "unknown";
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readMetadataString(value: Record<string, unknown> | null, key: string) {
  if (!value) {
    return null;
  }

  const entry = value[key];
  return typeof entry === "string" && entry.length > 0 ? entry : null;
}

function readMetadataDecision(value: Record<string, unknown> | null, key: string) {
  const entry = readMetadataString(value, key);
  return entry === "continue_merge" || entry === "request_patch" || entry === "stop_merge"
    ? entry
    : null;
}

function normalizeSettlementStatus(value: string | null | undefined): SigillumSettlementStatus | null {
  return value === "gateway_received" ||
    value === "batched" ||
    value === "confirmed" ||
    value === "completed" ||
    value === "failed" ||
    value === "unresolved"
    ? value
    : null;
}

function normalizeSettlementScope(value: string | null | undefined): SigillumSettlementScope | null {
  return value === "individual" || value === "batch" || value === "unknown" ? value : null;
}

function normalizeSettlementSource(value: string | null | undefined): SigillumSettlementSource | null {
  return value === "gateway_api" ||
    value === "gateway_transfer_payload" ||
    value === "arc_log_resolution" ||
    value === "manual_backfill"
    ? value
    : null;
}

function toSettlementProof(
  paymentEvent: typeof paymentEvents.$inferSelect,
  fallback: SigillumSettlementProof,
): SigillumSettlementProof {
  return {
    payment_reference: paymentEvent.paymentReference ?? fallback.payment_reference,
    transaction_hash: paymentEvent.transactionHash ?? fallback.transaction_hash,
    settlement_status:
      normalizeSettlementStatus(paymentEvent.settlementStatus) ?? fallback.settlement_status,
    settlement_scope:
      normalizeSettlementScope(paymentEvent.settlementScope) ?? fallback.settlement_scope,
    settlement_source:
      normalizeSettlementSource(paymentEvent.settlementSource) ?? fallback.settlement_source,
    transaction_confirmed_at:
      paymentEvent.transactionConfirmedAt?.toISOString() ?? fallback.transaction_confirmed_at,
    batch_reference: paymentEvent.batchReference ?? fallback.batch_reference,
    gateway_transfer_json:
      (paymentEvent.gatewayTransferJson as Record<string, unknown> | null) ??
      fallback.gateway_transfer_json,
    settlement_last_checked_at:
      paymentEvent.settlementLastCheckedAt?.toISOString() ?? fallback.settlement_last_checked_at,
  };
}

function shouldRefreshSettlementProof(paymentEvent: typeof paymentEvents.$inferSelect) {
  if (!paymentEvent.paymentReference || paymentEvent.rail !== "x402") {
    return false;
  }

  const status = normalizeSettlementStatus(paymentEvent.settlementStatus);
  return (
    paymentEvent.transactionHash === null ||
    status === null ||
    status === "gateway_received" ||
    status === "unresolved"
  );
}

async function refreshPaymentRow(paymentEventId: string) {
  await reconcilePaymentEventSettlementProof(paymentEventId);
  return db.query.paymentEvents.findFirst({
    where: eq(paymentEvents.id, paymentEventId),
  });
}

function toMicroUsdc(amount: string) {
  const [wholePart, fractionPart = ""] = amount.trim().split(".");
  const padded = `${fractionPart}000000`.slice(0, 6);
  return BigInt(wholePart || "0") * BigInt(1_000_000) + BigInt(padded || "0");
}

function fromMicroUsdc(value: bigint) {
  const whole = value / BigInt(1_000_000);
  const fractional = (value % BigInt(1_000_000)).toString().padStart(6, "0");
  return `${whole.toString()}.${fractional}`;
}
