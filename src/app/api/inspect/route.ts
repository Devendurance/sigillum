import { NextResponse } from "next/server";
import { analyzeDiff } from "@/lib/sigillum/analyzer";
import { generateSigillumReceipt } from "@/lib/sigillum/receipt";
import { calculateQuote } from "@/lib/sigillum/quote";
import { sampleRiskyDiff } from "@/lib/sigillum/sample-diff";
import { evaluateAgentDecision } from "@/lib/sigillum/policy";
import { verifySigillumPayment } from "@/lib/sigillum/payment";

type InspectBody = {
  diff?: string;
  quote_id?: string;
  payment_confirmed?: boolean;
  payment_proof?: string;
  payment_signature?: string;
};

export async function POST(request: Request) {
  const body = await readJsonBody<InspectBody>(request);
  const diff = normalizeDiff(body.diff);
  const quote = calculateQuote(diff);
  const paymentVerification = await verifySigillumPayment({
    amount: quote.amount,
    quoteId: body.quote_id ?? quote.quote_id,
    paymentConfirmed: body.payment_confirmed,
    paymentProof: body.payment_proof,
    paymentSignature:
      request.headers.get("PAYMENT-SIGNATURE") ??
      request.headers.get("payment-signature") ??
      request.headers.get("X-PAYMENT") ??
      body.payment_signature ??
      undefined,
    expiresAt: quote.expires_at,
    resourceUrl: new URL(request.url).pathname,
  });

  if (!paymentVerification.ok) {
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
        headers: {
          ...(paymentVerification.response_headers ?? {}),
          "X-Sigillum-Mode": paymentVerification.mode === "demo" ? "local-demo-payment-simulation" : "x402-payment-adapter",
          "X-Sigillum-Payment-Mode": paymentVerification.mode,
          "X-Sigillum-Payment-Rail": paymentVerification.rail,
          "X-Sigillum-Quote-ID": paymentVerification.requirement.quote_id ?? quote.quote_id,
        },
      },
    );
  }

  const findings = analyzeDiff(diff);
  const receipt = generateSigillumReceipt(diff, quote.amount);
  const agentDecision = evaluateAgentDecision(receipt.score, findings);

  return NextResponse.json(
    {
      receipt,
      agent_decision: agentDecision,
      payment: {
        mode: paymentVerification.mode,
        rail: paymentVerification.rail,
        payment_reference: paymentVerification.payment_reference,
      },
    },
    {
      headers: {
        ...(paymentVerification.response_headers ?? {}),
        "X-Sigillum-Mode": paymentVerification.mode === "demo" ? "local-demo-payment-simulation" : "x402-payment-adapter",
        "X-Sigillum-Payment-Mode": paymentVerification.mode,
        "X-Sigillum-Payment-Rail": paymentVerification.rail,
        "X-Sigillum-Quote-ID": body.quote_id ?? quote.quote_id,
      },
    },
  );
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

function normalizeDiff(diff?: string): string {
  if (typeof diff !== "string" || diff.trim().length === 0) {
    return sampleRiskyDiff;
  }

  return diff;
}
