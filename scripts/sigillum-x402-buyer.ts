import * as fs from "node:fs";
import * as path from "node:path";

type ParsedArgs = {
  allowDemoConfirm: boolean;
  baseUrl: string;
  diff?: string;
  diffFile?: string;
};

const DEFAULT_BASE_URL = "http://localhost:3000";

async function main() {
  const cliClient = await import(new URL("../src/lib/sigillum/cli-client.ts", import.meta.url).href);
  cliClient.loadSigillumEnvFiles({ fs, path });

  try {
    const args = parseArgs(process.argv.slice(2));
    const client = cliClient.createSigillumClient({
      baseUrl: args.baseUrl,
      allowDemoConfirm: args.allowDemoConfirm,
    });
    const result = await client.inspectDiff({
      diff: resolveDiff(args),
      allowDemoConfirm: args.allowDemoConfirm,
    });

    console.log("SUCCESS");
    console.log(
      [
        `amount=${result.payment.amount} USDC`,
        `mode=${result.payment.mode}`,
        `rail=${result.payment.rail}`,
        result.payment.transaction ? `tx=${result.payment.transaction}` : null,
        result.payment.payment_reference ? `ref=${result.payment.payment_reference}` : null,
      ]
        .filter(Boolean)
        .join(" | "),
    );
    console.log(
      [
        `receipt=${result.receipt.receipt_id}`,
        `risk_score=${result.receipt.score}`,
        `recommendation=${result.receipt.recommendation}`,
        `decision=${result.agent_decision.agent_decision}`,
      ].join(" | "),
    );
  } catch (error) {
    if (isCliErrorShape(error)) {
      console.error("FAILURE");
      console.error(`phase=${error.phase} | summary=${error.message}`);
      if (error.detail) {
        console.error(`detail=${error.detail}`);
      }
      process.exitCode = error.exitCode;
      return;
    }

    console.error("FAILURE");
    console.error(
      `phase=runtime | summary=${error instanceof Error ? error.message : String(error)}`,
    );
    process.exitCode = 3;
  }
}

function parseArgs(argv: string[]): ParsedArgs {
  const parsed: ParsedArgs = {
    allowDemoConfirm: false,
    baseUrl: readEnvFromProcess("SIGILLUM_BASE_URL", "X402_API_BASE_URL") || DEFAULT_BASE_URL,
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

function resolveDiff(args: ParsedArgs): string {
  if (args.diffFile) {
    return fs.readFileSync(path.resolve(process.cwd(), args.diffFile), "utf8");
  }

  if (args.diff && args.diff.trim()) {
    return args.diff;
  }

  return defaultSampleDiff();
}

function readEnvFromProcess(...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = process.env[key]?.trim();
    if (value) {
      return value;
    }
  }

  return undefined;
}

function isCliErrorShape(
  error: unknown,
): error is { phase: string; message: string; detail?: string; exitCode: 3 } {
  return (
    typeof error === "object" &&
    error !== null &&
    "phase" in error &&
    "message" in error &&
    "exitCode" in error
  );
}

function defaultSampleDiff(): string {
  return `diff --git a/package.json b/package.json
index 8f3a1c2..b2c9c41 100644
--- a/package.json
+++ b/package.json
@@ -7,6 +7,7 @@
   "dependencies": {
     "next": "16.2.9",
+    "postinstall-guard": "^1.0.0"
   },
diff --git a/.env.example b/.env.example
index 4c2a1d0..7b01a83 100644
--- a/.env.example
+++ b/.env.example
@@ -1,3 +1,4 @@
 NEXT_PUBLIC_APP_URL=http://localhost:3000
+OPENAI_API_KEY=sk_live_demo_supersecret
 SESSION_SECRET=replace-me`;
}

void main();
