let fs: typeof import("node:fs");
let path: typeof import("node:path");

type Quote = {
  quote_id: string;
  amount: string;
  currency: string;
  expires_at: string;
  inspected_units: {
    changed_lines: number;
    ast_nodes: number;
    dependency_changes: number;
    config_mutations: number;
    strings: number;
  };
};

type InspectSuccess = {
  receipt: {
    receipt_id: string;
    score: number;
    recommendation: string;
    paid_amount_usdc: string;
  };
  agent_decision: {
    agent_decision: string;
    next_action: string;
  };
  payment?: {
    mode?: string;
    rail?: string;
    payment_reference?: string;
  };
};

type ParsedArgs = {
  allowDemoConfirm: boolean;
  baseUrl: string;
  diff?: string;
  diffFile?: string;
};

type SupportedChainName = import("@circle-fin/x402-batching/client").SupportedChainName;
type HexString = `0x${string}`;

const DEFAULT_BASE_URL = "http://localhost:3000";
const DEFAULT_DIFF = `diff --git a/.env.example b/.env.example
index 4c2a1d0..7b01a83 100644
--- a/.env.example
+++ b/.env.example
@@ -1,3 +1,4 @@
 NEXT_PUBLIC_APP_URL=http://localhost:3000
+OPENAI_API_KEY=sk_live_demo_supersecret
 SESSION_SECRET=replace-me
diff --git a/src/lib/run.ts b/src/lib/run.ts
index 7c4a0f0..9f87b2f 100644
--- a/src/lib/run.ts
+++ b/src/lib/run.ts
@@ -1,5 +1,7 @@
 export function runPlugin(payload: string) {
-  return payload;
+  const body = eval(payload);
+  const fn = new Function("return globalThis.__SIGILLUM__", body);
+  return fn();
 }`;

async function main() {
  fs = await import("node:fs");
  path = await import("node:path");
  loadEnvFiles();

  const args = parseArgs(process.argv.slice(2));
  const baseUrl = normalizeBaseUrl(args.baseUrl);
  const quoteUrl = `${baseUrl}/api/quote`;
  const inspectUrl = `${baseUrl}/api/inspect`;
  const diff = resolveDiff(args);

  try {
    const quoteResponse = await postJson(quoteUrl, { diff });
    if (!quoteResponse.ok) {
      return fail("quote", `quote request failed with HTTP ${quoteResponse.status}`);
    }

    const quote = (await quoteResponse.json()) as Quote;
    const firstInspectResponse = await postJson(inspectUrl, {
      diff,
      quote_id: quote.quote_id,
    });

    if (firstInspectResponse.ok) {
      const result = (await firstInspectResponse.json()) as InspectSuccess;
      return succeed({
        amount: quote.amount,
        mode: result.payment?.mode ?? "unknown",
        rail: result.payment?.rail ?? "unknown",
        receiptId: result.receipt.receipt_id,
        recommendation: result.receipt.recommendation,
        score: result.receipt.score,
        decision: result.agent_decision.agent_decision,
        reference: result.payment?.payment_reference,
        caveat: "inspection completed without a 402 challenge",
      });
    }

    const inspectBody = await safeJson(firstInspectResponse);
    if (firstInspectResponse.status !== 402) {
      return fail(
        "inspect",
        `inspect request failed with HTTP ${firstInspectResponse.status}`,
        readReason(inspectBody),
      );
    }

    const declaredMode =
      readHeader(firstInspectResponse, "x-sigillum-payment-mode") ??
      readNestedString(inspectBody, "payment", "mode") ??
      "unknown";

    if (declaredMode === "demo") {
      if (!args.allowDemoConfirm) {
        return fail(
          "payment",
          "server is in demo payment mode",
          "rerun with --allow-demo-confirm to exercise the current local demo path",
        );
      }

      const demoResponse = await postJson(inspectUrl, {
        diff,
        quote_id: quote.quote_id,
        payment_confirmed: true,
        payment_proof: "sigillum-local-demo-buyer",
      });

      if (!demoResponse.ok) {
        const demoBody = await safeJson(demoResponse);
        return fail(
          "payment",
          `demo confirm retry failed with HTTP ${demoResponse.status}`,
          readReason(demoBody),
        );
      }

      const result = (await demoResponse.json()) as InspectSuccess;
      return succeed({
        amount: quote.amount,
        mode: result.payment?.mode ?? "demo",
        rail: result.payment?.rail ?? "local-demo",
        receiptId: result.receipt.receipt_id,
        recommendation: result.receipt.recommendation,
        score: result.receipt.score,
        decision: result.agent_decision.agent_decision,
        reference: result.payment?.payment_reference,
        caveat: "used the local demo confirmation path; no real x402 settlement happened",
      });
    }

    const privateKey = readEnv("SIGILLUM_BUYER_PRIVATE_KEY", "X402_BUYER_PRIVATE_KEY");
    if (!privateKey) {
      return fail(
        "payment",
        "buyer private key is required for the real x402 buyer flow",
        "the server returned 402 and did not expose a usable demo path",
      );
    }

    const chain = (readEnv("SIGILLUM_BUYER_CHAIN", "X402_NETWORK") || "arcTestnet") as SupportedChainName;
    const rpcUrl = readEnv("SIGILLUM_BUYER_RPC_URL", "X402_RPC_URL");
    const autoDepositAmount = readEnv("X402_BUYER_AUTO_DEPOSIT_USDC");
    const { GatewayClient } = await import("@circle-fin/x402-batching/client");
    const gateway = new GatewayClient({
      chain,
      privateKey: privateKey as HexString,
      ...(rpcUrl ? { rpcUrl } : {}),
    });

    if (autoDepositAmount) {
      await gateway.deposit(autoDepositAmount);
    }

    const paidResult = (await gateway.pay(inspectUrl, {
      method: "POST",
      body: {
        diff,
        quote_id: quote.quote_id,
      },
      headers: {
        "Content-Type": "application/json",
      },
    })) as { data: InspectSuccess; transaction: string };

    const result = paidResult.data;
    return succeed({
      amount: quote.amount,
      mode: result.payment?.mode ?? "x402",
      rail: result.payment?.rail ?? "x402",
      receiptId: result.receipt.receipt_id,
      recommendation: result.receipt.recommendation,
      score: result.receipt.score,
      decision: result.agent_decision.agent_decision,
      transaction: paidResult.transaction,
      reference: result.payment?.payment_reference,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return fail("runtime", "buyer harness failed", message);
  }
}

function loadEnvFiles() {
  for (const fileName of [".env.local", ".env"]) {
    const filePath = path.join(process.cwd(), fileName);
    if (!fs.existsSync(filePath)) {
      continue;
    }

    const contents = fs.readFileSync(filePath, "utf8");
    for (const line of contents.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) {
        continue;
      }

      const separator = trimmed.indexOf("=");
      if (separator <= 0) {
        continue;
      }

      const key = trimmed.slice(0, separator).trim();
      if (!key || process.env[key] !== undefined) {
        continue;
      }

      let value = trimmed.slice(separator + 1).trim();
      if (
        (value.startsWith("\"") && value.endsWith("\"")) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }

      process.env[key] = value;
    }
  }
}

function parseArgs(argv: string[]): ParsedArgs {
  const parsed: ParsedArgs = {
    allowDemoConfirm: false,
    baseUrl: readEnv("SIGILLUM_BASE_URL", "X402_API_BASE_URL") || DEFAULT_BASE_URL,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--allow-demo-confirm") {
      parsed.allowDemoConfirm = true;
      continue;
    }

    const next = argv[index + 1];
    if (!next) {
      continue;
    }

    if (arg === "--base-url") {
      parsed.baseUrl = next;
      index += 1;
      continue;
    }

    if (arg === "--diff") {
      parsed.diff = next;
      index += 1;
      continue;
    }

    if (arg === "--diff-file") {
      parsed.diffFile = next;
      index += 1;
    }
  }

  return parsed;
}

function normalizeBaseUrl(value: string): string {
  return value.replace(/\/+$/, "");
}

function readEnv(...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = process.env[key]?.trim();
    if (value) {
      return value;
    }
  }

  return undefined;
}

function resolveDiff(args: ParsedArgs): string {
  if (args.diffFile) {
    return fs.readFileSync(path.resolve(process.cwd(), args.diffFile), "utf8");
  }

  if (args.diff && args.diff.trim()) {
    return args.diff;
  }

  return DEFAULT_DIFF;
}

async function postJson(url: string, body: unknown): Promise<Response> {
  return fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

async function safeJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function readHeader(response: Response, name: string): string | null {
  return response.headers.get(name);
}

function readReason(body: unknown): string | undefined {
  if (!body || typeof body !== "object") {
    return undefined;
  }

  const paymentBody = "payment" in body ? body.payment : undefined;
  const paymentMessage =
    paymentBody && typeof paymentBody === "object" && "message" in paymentBody
      ? paymentBody.message
      : undefined;

  return (
    readRecordString(body, "reason") ??
    readRecordString(body, "message") ??
    readRecordString(body, "error") ??
    (typeof paymentMessage === "string" ? paymentMessage : undefined) ??
    undefined
  );
}

function readRecordString(value: object, key: string): string | undefined {
  if (!(key in value)) {
    return undefined;
  }

  const recordValue = (value as Record<string, unknown>)[key];
  return typeof recordValue === "string" ? recordValue : undefined;
}

function readNestedString(value: unknown, outerKey: string, innerKey: string): string | undefined {
  if (!value || typeof value !== "object" || !(outerKey in value)) {
    return undefined;
  }

  const outerValue = (value as Record<string, unknown>)[outerKey];
  if (!outerValue || typeof outerValue !== "object" || !(innerKey in outerValue)) {
    return undefined;
  }

  const innerValue = (outerValue as Record<string, unknown>)[innerKey];
  return typeof innerValue === "string" ? innerValue : undefined;
}

function succeed(input: {
  amount: string;
  mode: string;
  rail: string;
  receiptId: string;
  recommendation: string;
  score: number;
  decision: string;
  transaction?: string;
  reference?: string;
  caveat?: string;
}) {
  console.log("SUCCESS");
  console.log(
    [
      `amount=${input.amount} USDC`,
      `mode=${input.mode}`,
      `rail=${input.rail}`,
      input.transaction ? `tx=${input.transaction}` : null,
      input.reference ? `ref=${input.reference}` : null,
    ]
      .filter(Boolean)
      .join(" | "),
  );
  console.log(
    [
      `receipt=${input.receiptId}`,
      `score=${input.score}`,
      `recommendation=${input.recommendation}`,
      `decision=${input.decision}`,
    ].join(" | "),
  );
  if (input.caveat) {
    console.log(`caveat=${input.caveat}`);
  }
}

function fail(phase: string, summary: string, detail?: string) {
  console.error("FAILURE");
  console.error(`phase=${phase} | summary=${summary}`);
  if (detail) {
    console.error(`detail=${detail}`);
  }
  process.exitCode = 1;
}

void main();
