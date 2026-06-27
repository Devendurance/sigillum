import { createHash, randomUUID } from "node:crypto";
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
  SigillumLiveActionRow,
  SigillumPublicReceipt,
  SigillumReceipt,
} from "@/lib/sigillum/types";
import {
  maxSigillumActionStage,
  type SigillumActionEnvelope,
  type SigillumActionStage,
} from "@/lib/sigillum/lifecycle";
import type { PaymentRail, SigillumPaymentMode } from "@/lib/sigillum/payment/types";
import { createSigillumReceiptHash } from "@/lib/sigillum/receipt-hash";
import { formatSigillumNetworkLabel } from "@/lib/sigillum/arcscan";
import { getSigillumX402Network } from "@/lib/sigillum/payment/config";
import { isExplorerTransactionHash, resolveSigillumTransactionHash } from "./sigillum-payment-provenance";

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
      repo: envelope.action_input.repo ?? null,
      branch: envelope.action_input.branch ?? null,
      commitSha: envelope.action_input.commit_sha ?? null,
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

export async function ensurePaymentEventTransactionHash(paymentEventId: string) {
  const paymentEvent = await db.query.paymentEvents.findFirst({
    where: eq(paymentEvents.id, paymentEventId),
  });

  if (!paymentEvent?.paymentReference || paymentEvent.transactionHash) {
    return paymentEvent?.transactionHash ?? null;
  }

  const transactionHash = await resolveSigillumTransactionHash(paymentEvent.paymentReference);
  if (!transactionHash) {
    return null;
  }

  const [updated] = await db
    .update(paymentEvents)
    .set({
      transactionHash,
    })
    .where(eq(paymentEvents.id, paymentEventId))
    .returning();

  return updated?.transactionHash ?? transactionHash;
}

export async function createInspection({
  action,
  quote,
  inspectedUnits,
  diff,
}: {
  action: ActionRow;
  quote: QuoteRow;
  inspectedUnits: InspectedUnits;
  diff: string;
}) {
  const [inspection] = await db
    .insert(inspections)
    .values({
      actionId: action.id,
      quoteRowId: quote.id,
      status: "inspection_running",
      inspectedUnits,
      sourceHash: createHash("sha256").update(diff).digest("hex"),
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

  const payment =
    paymentRow &&
    (paymentRow.mode === "demo" || paymentRow.mode === "x402") &&
    (paymentRow.rail === "local-demo" || paymentRow.rail === "x402")
      ? {
          mode: paymentRow.mode as SigillumPaymentMode,
          rail: paymentRow.rail as PaymentRail,
          payment_reference: paymentRow.paymentReference ?? undefined,
          transaction_hash: paymentRow.transactionHash ?? undefined,
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

  const latestPaymentByAction = new Map<
    string,
    {
      transactionHash: string | null;
      paymentReference: string | null;
      rail: PaymentRail | null;
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
      });
    }
  }

  const latestInspectionByAction = new Map<string, string | null>();
  for (const inspection of inspectionRows) {
    if (!latestInspectionByAction.has(inspection.actionId)) {
      latestInspectionByAction.set(inspection.actionId, inspection.sourceHash);
    }
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
      action_type: row.actionType as "code_change",
      current_stage: row.currentStage as SigillumActionStage,
      amount: row.amount,
      rail: payment?.rail ?? null,
      network: payment?.rail === "x402" ? network : null,
      transaction_hash: payment?.transactionHash ?? null,
      payment_reference: payment?.paymentReference ?? null,
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
      safe_summary: createSafeSummary({
        actionType: row.actionType,
        inspectedUnits,
        findingsCategories,
        sourceHash: latestInspectionByAction.get(row.actionRowId) ?? null,
      }),
      timestamp: row.timestamp.toISOString(),
    };
  });
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

  return {
    receipt_id: receiptRow.receiptId,
    action_id: action.publicId,
    agent_name: agent.name,
    action_type: action.actionType as "code_change",
    risk_score: receiptRow.score,
    recommendation: receiptRow.recommendation as SigillumPublicReceipt["recommendation"],
    paid_amount_usdc: receiptRow.paidAmountUsdc,
    rail:
      paymentRow?.rail === "local-demo" || paymentRow?.rail === "x402"
        ? paymentRow.rail
        : null,
    network: paymentRow?.rail === "x402" ? formatSigillumNetworkLabel(getSigillumX402Network()) : null,
    transaction_hash: paymentRow?.transactionHash ?? null,
    payment_reference: paymentRow?.paymentReference ?? null,
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

function createSafeSummary({
  actionType,
  inspectedUnits,
  findingsCategories,
  sourceHash,
}: {
  actionType: string;
  inspectedUnits: InspectedUnits | null;
  findingsCategories: string[];
  sourceHash: string | null;
}) {
  const changedLines = inspectedUnits?.changed_lines ?? 0;
  const categorySummary =
    findingsCategories.length > 0 ? findingsCategories.join(", ") : "no finding categories recorded";
  const hashSummary = sourceHash ? ` hash ${sourceHash.slice(0, 12)}` : "";
  return `${actionType.replaceAll("_", " ")} inspected with ${changedLines} changed lines, ${categorySummary},${hashSummary}`.replace(/,\s*$/, "");
}

function toFileType(filePath: string | undefined) {
  if (!filePath) {
    return null;
  }

  const match = filePath.match(/(\.[A-Za-z0-9]+)$/);
  return match ? match[1].toLowerCase() : "unknown";
}
