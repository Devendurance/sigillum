import { NextResponse } from "next/server";
import { calculateQuoteForAction } from "@/lib/sigillum/quote";
import { normalizeActionEnvelope } from "@/lib/sigillum/action-payload";
import { getSigillumPaymentMode } from "@/lib/sigillum/payment/config";
import { logSigillumError, logSigillumInfo } from "@/lib/server/sigillum-log";
import type { QuoteResponse } from "@/lib/sigillum/types";

type QuoteBody = {
  diff?: string;
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
  const body = await readJsonBody<QuoteBody>(request);
  const envelope = normalizeActionEnvelope(body, {
    defaultAgentName: "Sigillum API",
  });

  if (!envelope) {
    return NextResponse.json(
      {
        error: "invalid_action_payload",
        message:
          getSigillumPaymentMode() === "x402"
            ? "Live Sigillum quotes require a valid action envelope with the required action input."
            : "Sigillum quote requests require a valid action payload.",
      },
      { status: 400 },
    );
  }

  const quote = calculateQuoteForAction(envelope);
  try {
    const {
      createActionForQuote,
      createInitialActionTimeline,
      createQuoteForAction,
      upsertAgentFromEnvelope,
    } = await import("@/lib/server/sigillum-store");
    const agent = await upsertAgentFromEnvelope(envelope);
    const { action, quote: existingQuote } = await createActionForQuote({
      agent,
      envelope,
    });

    const quoteRow =
      existingQuote ??
      (await createQuoteForAction({
        action,
        quote,
      }));

    if (!existingQuote) {
      await createInitialActionTimeline({
        action,
        quote: quoteRow,
      });
    }

    logSigillumInfo("quote.created", {
      action_id: action.publicId,
      quote_id: quote.quote_id,
      amount: quote.amount,
      agent_name: envelope.agent.name,
    });

    const responseBody: QuoteResponse = {
      ...quote,
      action_id: action.publicId,
      current_stage: "quote_created",
    };

    return NextResponse.json(responseBody, {
      headers: {
        "X-Sigillum-Payment-Mode": getSigillumPaymentMode(),
        "X-Sigillum-Action-ID": action.publicId,
      },
    });
  } catch (error) {
    logSigillumError("quote.failed", error, {
      payment_mode: getSigillumPaymentMode(),
    });

    return NextResponse.json(
      {
        error: "quote_failed",
        message: "Sigillum could not create a persisted quote.",
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
