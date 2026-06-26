import { NextResponse } from "next/server";
import { analyzeDiff } from "@/lib/sigillum/analyzer";
import { generateSigillumReceipt } from "@/lib/sigillum/receipt";
import { calculateQuote } from "@/lib/sigillum/quote";
import { sampleRiskyDiff } from "@/lib/sigillum/sample-diff";
import { evaluateAgentDecision } from "@/lib/sigillum/policy";

type InspectBody = {
  diff?: string;
  quote_id?: string;
  payment_confirmed?: boolean;
};

export async function POST(request: Request) {
  const body = await readJsonBody<InspectBody>(request);
  const diff = normalizeDiff(body.diff);

  if (body.payment_confirmed !== true) {
    // Local demo payment simulation: the app exposes the x402-style gate, but real payment wiring is not integrated yet.
    return NextResponse.json(
      {
        error: "payment_required",
        status: 402,
        message: "HTTP 402 Payment Required",
        payment: {
          network: "Arc",
          rail: "x402",
          currency: "USDC",
          amount: "0.000043",
        },
      },
      {
        status: 402,
        headers: {
          "X-Sigillum-Mode": "local-demo-payment-simulation",
        },
      },
    );
  }

  const quote = calculateQuote(diff);
  const findings = analyzeDiff(diff);
  const receipt = generateSigillumReceipt(diff, quote.amount);
  const agentDecision = evaluateAgentDecision(receipt.score, findings);

  return NextResponse.json(
    {
      receipt,
      agent_decision: agentDecision,
    },
    {
      headers: {
        "X-Sigillum-Mode": "local-demo-payment-simulation",
        ...(body.quote_id ? { "X-Sigillum-Quote-ID": body.quote_id } : {}),
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

