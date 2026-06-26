import { NextResponse } from "next/server";
import { calculateQuote } from "@/lib/sigillum/quote";
import { sampleRiskyDiff } from "@/lib/sigillum/sample-diff";

type QuoteBody = {
  diff?: string;
};

export async function POST(request: Request) {
  const body = await readJsonBody<QuoteBody>(request);
  const diff = normalizeDiff(body.diff);
  const quote = calculateQuote(diff);

  return NextResponse.json(quote, {
    headers: {
      "X-Sigillum-Mode": "local-demo-payment-simulation",
    },
  });
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

