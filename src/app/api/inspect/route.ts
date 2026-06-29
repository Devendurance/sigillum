import { NextResponse } from "next/server";
import { normalizeActionEnvelope } from "@/lib/sigillum/action-payload";
import { verifySigillumPayment } from "@/lib/sigillum/payment";
import { getSigillumPaymentMode } from "@/lib/sigillum/payment/config";
import { evaluateAgentDecision } from "@/lib/sigillum/policy";
import { calculateQuoteForAction } from "@/lib/sigillum/quote";
import { generateSigillumReceiptForAction } from "@/lib/sigillum/receipt";
import { logSigillumError, logSigillumInfo } from "@/lib/server/sigillum-log";
import type { PaymentVerificationResult } from "@/lib/sigillum/payment/types";

type InspectBody = {
  diff?: string;
  action_id?: string;
  quote_id?: string;
  payment_confirmed?: boolean;
  payment_proof?: string;
  payment_signature?: string;
  idempotency_key?: string;
  agent?: {
    id?: string;
    name?: string;
    type?: string;
  };
  action_type?: string;
  action_input?: Record<string, unknown>;
};

export async function POST(request: Request) {
  const body = await readJsonBody<InspectBody>(request);
  const paymentMode = getSigillumPaymentMode();
  const actionId = typeof body.action_id === "string" ? body.action_id.trim() : "";
  const quoteId = typeof body.quote_id === "string" ? body.quote_id.trim() : "";

  if (paymentMode === "x402" && (!actionId || !quoteId)) {
    return NextResponse.json(
      {
        error: "missing_action_reference",
        message: "Live Sigillum inspect requests require both action_id and quote_id.",
      },
      { status: 400 },
    );
  }

  const envelope = normalizeActionEnvelope(body, {
    defaultAgentName: "Sigillum API",
  });

  if (!envelope) {
    return NextResponse.json(
      {
        error: "invalid_action_payload",
        message:
          paymentMode === "x402"
            ? "Live Sigillum inspections require a valid action envelope with the required action input."
            : "Sigillum inspect requests require a valid action payload.",
      },
      { status: 400 },
    );
  }

  try {
    const {
      createActionForQuote,
      createInitialActionTimeline,
      createInspection,
      createQuoteForAction,
      findActionByPublicId,
      findCompletedOutcome,
      findQuoteByQuoteId,
      findQuoteForAction,
      reconcilePaymentEventSettlementProof,
      recordPaymentConfirmed,
      recordPaymentRequired,
      storeReceiptAndDecision,
      upsertAgentFromEnvelope,
    } = await import("@/lib/server/sigillum-store");

    let action = actionId ? await findActionByPublicId(actionId) : null;
    let quoteRow =
      action && quoteId
        ? await findQuoteForAction({ actionId: action.id, quoteId })
        : quoteId
          ? await findQuoteByQuoteId(quoteId)
          : null;

    if (paymentMode === "x402" && (!action || !quoteRow || quoteRow.actionId !== action.id)) {
      return NextResponse.json(
        {
          error: "invalid_action_reference",
          message: "Sigillum could not find a persisted action and quote for this live inspection.",
        },
        { status: 404 },
      );
    }

    const quote = calculateQuoteForAction(envelope);
    if (quoteRow && quote.quote_id !== quoteRow.quoteId) {
      return NextResponse.json(
        {
          error: "quote_payload_mismatch",
          message: "The supplied action payload no longer matches the persisted quote.",
        },
        { status: 409 },
      );
    }

    if (!action || !quoteRow) {
      const agent = await upsertAgentFromEnvelope(envelope);
      const created = await createActionForQuote({
        agent,
        envelope,
      });

      action = action ?? created.action;
      quoteRow =
        created.quote ??
        (await createQuoteForAction({
          action,
          quote,
        }));

      if (!created.quote) {
        await createInitialActionTimeline({
          action,
          quote: quoteRow,
        });
      }
    }

    const paymentVerification = await verifySigillumPayment({
      amount: quoteRow?.amount ?? quote.amount,
      quoteId: quoteId || quote.quote_id,
      paymentConfirmed: body.payment_confirmed,
      paymentProof: body.payment_proof,
      paymentSignature:
        request.headers.get("PAYMENT-SIGNATURE") ??
        request.headers.get("payment-signature") ??
        request.headers.get("X-PAYMENT") ??
        body.payment_signature ??
        undefined,
      expiresAt: quoteRow?.expiresAt.toISOString() ?? quote.expires_at,
      resourceUrl: new URL(request.url).pathname,
    });

    if (!paymentVerification.ok) {
      if (action && quoteRow) {
        await recordPaymentRequired({
          action,
          quote: quoteRow,
          verification: paymentVerification,
        });
      }

      logSigillumInfo("inspect.payment_required", {
        action_id: action?.publicId ?? actionId,
        quote_id: quoteId || quote.quote_id,
        mode: paymentVerification.mode,
        rail: paymentVerification.rail,
      });

      return NextResponse.json(
        {
          error: "payment_required",
          status: paymentVerification.requirement.status_code,
          message: paymentVerification.requirement.message,
          payment: paymentVerification.requirement,
          reason: paymentVerification.reason,
        },
        {
          status: 402,
          headers: failureHeaders(
            paymentVerification,
            quoteId || quote.quote_id,
            action?.publicId ?? (actionId || undefined),
          ),
        },
      );
    }

    const persistedAction = action;
    const persistedQuote = quoteRow;
    if (!persistedAction || !persistedQuote) {
      return NextResponse.json(
        {
          error: "missing_persistence_context",
          message: "Sigillum could not resolve a persisted action for this inspection.",
        },
        { status: 409 },
      );
    }

    const completedOutcome = await findCompletedOutcome(persistedAction.id);
    if (completedOutcome) {
      logSigillumInfo("inspect.replay_completed_result", {
        action_id: persistedAction.publicId,
        quote_id: persistedQuote.quoteId,
      });

      return NextResponse.json(
        {
          action_id: persistedAction.publicId,
          receipt: completedOutcome.receipt,
          agent_decision: completedOutcome.agentDecision,
          payment: completedOutcome.payment ?? {
            mode: paymentVerification.mode,
            rail: paymentVerification.rail,
            payment_reference: paymentVerification.payment_reference,
            transaction_hash: undefined,
            settlement_status: null,
            settlement_scope: null,
            settlement_source: null,
            transaction_confirmed_at: null,
            batch_reference: null,
          },
        },
        {
          headers: successHeaders(paymentVerification, quoteId || quote.quote_id, persistedAction.publicId),
        },
      );
    }

    const paymentEvent = await recordPaymentConfirmed({
      action: persistedAction,
      quote: persistedQuote,
      verification: paymentVerification,
    });

    const settlementProof = await reconcilePaymentEventSettlementProof(paymentEvent.id);

    logSigillumInfo("inspect.payment_confirmed", {
      action_id: persistedAction.publicId,
      quote_id: persistedQuote.quoteId,
      payment_reference: paymentVerification.payment_reference,
      transaction_hash: settlementProof?.transaction_hash ?? undefined,
      settlement_status: settlementProof?.settlement_status ?? null,
      settlement_scope: settlementProof?.settlement_scope ?? null,
      batch_reference: settlementProof?.batch_reference ?? null,
    });

    const inspection = await createInspection({
      action: persistedAction,
      quote: persistedQuote,
      inspectedUnits: quote.inspected_units,
      envelope,
    });

    logSigillumInfo("inspect.running", {
      action_id: persistedAction.publicId,
      inspection_id: inspection.id,
    });

    const receipt = generateSigillumReceiptForAction({
      envelope,
      paidAmountUsdc: persistedQuote.amount,
      actionId: persistedAction.publicId,
      paymentReference: paymentVerification.payment_reference,
    });
    const agentDecision = evaluateAgentDecision(receipt.score, receipt.findings);
    await storeReceiptAndDecision({
      action: persistedAction,
      inspection,
      receipt,
      agentDecision,
    });

    logSigillumInfo("inspect.receipt_persisted", {
      action_id: persistedAction.publicId,
      receipt_id: receipt.receipt_id,
      recommendation: receipt.recommendation,
      agent_decision: agentDecision.agent_decision,
    });

    return NextResponse.json(
      {
        action_id: persistedAction.publicId,
        receipt,
        agent_decision: agentDecision,
        payment: {
          mode: paymentVerification.mode,
          rail: paymentVerification.rail,
          payment_reference: paymentVerification.payment_reference,
          transaction_hash: settlementProof?.transaction_hash ?? undefined,
          settlement_status: settlementProof?.settlement_status ?? null,
          settlement_scope: settlementProof?.settlement_scope ?? null,
          settlement_source: settlementProof?.settlement_source ?? null,
          transaction_confirmed_at: settlementProof?.transaction_confirmed_at ?? null,
          batch_reference: settlementProof?.batch_reference ?? null,
        },
      },
      {
        headers: successHeaders(paymentVerification, quoteId || quote.quote_id, persistedAction.publicId),
      },
    );
  } catch (error) {
    logSigillumError("inspect.failed", error, {
      payment_mode: paymentMode,
      action_id: actionId || undefined,
      quote_id: quoteId || undefined,
    });

    return NextResponse.json(
      {
        error: "inspect_failed",
        message: "Sigillum could not complete the persisted inspection flow.",
      },
      { status: 503 },
    );
  }
}

async function readJsonBody<T>(request: Request): Promise<Partial<T>> {
  const text = await request.text();
  if (!text.trim()) {
    return {};
  }

  try {
    return JSON.parse(text) as Partial<T>;
  } catch {
    return {};
  }
}

function failureHeaders(
  paymentVerification: Extract<PaymentVerificationResult, { ok: false }>,
  quoteId: string,
  actionId?: string,
) {
  return {
    ...(paymentVerification.response_headers ?? {}),
    "X-Sigillum-Payment-Mode": paymentVerification.mode,
    "X-Sigillum-Payment-Rail": paymentVerification.rail,
    "X-Sigillum-Quote-ID": paymentVerification.requirement.quote_id ?? quoteId,
    ...(actionId ? { "X-Sigillum-Action-ID": actionId } : {}),
  };
}

function successHeaders(
  paymentVerification: Extract<PaymentVerificationResult, { ok: true }>,
  quoteId: string,
  actionId: string,
) {
  return {
    ...(paymentVerification.response_headers ?? {}),
    "X-Sigillum-Payment-Mode": paymentVerification.mode,
    "X-Sigillum-Payment-Rail": paymentVerification.rail,
    "X-Sigillum-Quote-ID": quoteId,
    "X-Sigillum-Action-ID": actionId,
  };
}
