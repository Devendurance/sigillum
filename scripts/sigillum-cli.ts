import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import type { SigillumInspectResult } from "../src/lib/sigillum/cli-client";
import type { Quote, SigillumRecommendation } from "../src/lib/sigillum/types";

type Command = "inspect" | "quote";

type ParsedArgs = {
  command: Command;
  targetPath?: string;
  useGitDiff: boolean;
  asJson: boolean;
  saveReceiptPath?: string;
  failOnWarn: boolean;
  baseUrl: string;
};

class CliCommandError extends Error {
  readonly phase: string;
  readonly detail?: string;
  readonly exitCode = 3 as const;

  constructor(phase: string, summary: string, detail?: string) {
    super(summary);
    this.name = "CliCommandError";
    this.phase = phase;
    this.detail = detail;
  }
}

const DEFAULT_BASE_URL = "http://localhost:3000";

async function main() {
  const cliClient = await loadCliClientModule();
  cliClient.loadSigillumEnvFiles({ fs, path });

  try {
    const args = parseArgs(process.argv.slice(2));
    const diff = readDiffInput(args);
    const client = cliClient.createSigillumClient({ baseUrl: args.baseUrl, allowDemoConfirm: true });

    if (args.command === "quote") {
      const quote = await client.quote(diff);
      renderQuoteOutput(quote, args.asJson);
      return;
    }

    const inspectResult = await client.inspectDiff({ diff, allowDemoConfirm: true });
    const savedReceiptPath = maybeSaveReceipt(args.saveReceiptPath, inspectResult);
    renderInspectOutput(inspectResult, args.asJson, savedReceiptPath);
    process.exitCode = exitCodeForRecommendation(inspectResult.receipt.recommendation, args.failOnWarn);
  } catch (error) {
    renderFailure(error);
  }
}

function parseArgs(argv: string[]): ParsedArgs {
  const [commandToken, ...rest] = argv;

  if (commandToken !== "inspect" && commandToken !== "quote") {
    throw new CliCommandError(
      "usage",
      "Usage: npm run sigillum -- <inspect|quote> <diff-path|--git-diff> [options]",
    );
  }

  const parsed: ParsedArgs = {
    command: commandToken,
    useGitDiff: false,
    asJson: false,
    failOnWarn: false,
    baseUrl: readEnvFromProcess("SIGILLUM_BASE_URL", "X402_API_BASE_URL") || DEFAULT_BASE_URL,
  };

  for (let index = 0; index < rest.length; index += 1) {
    const token = rest[index];

    if (token === "--git-diff") {
      parsed.useGitDiff = true;
      continue;
    }

    if (token === "--json") {
      parsed.asJson = true;
      continue;
    }

    if (token === "--fail-on-warn") {
      parsed.failOnWarn = true;
      continue;
    }

    const next = rest[index + 1];

    if (token === "--save-receipt") {
      if (!next) {
        throw new CliCommandError("usage", "Missing value for --save-receipt.");
      }
      parsed.saveReceiptPath = next;
      index += 1;
      continue;
    }

    if (token === "--base-url") {
      if (!next) {
        throw new CliCommandError("usage", "Missing value for --base-url.");
      }
      parsed.baseUrl = next;
      index += 1;
      continue;
    }

    if (!token.startsWith("--") && !parsed.targetPath) {
      parsed.targetPath = token;
      continue;
    }

    throw new CliCommandError("usage", `Unexpected argument: ${token}`);
  }

  if (parsed.useGitDiff && parsed.targetPath) {
    throw new CliCommandError("usage", "Pass either a diff file path or --git-diff, not both.");
  }

  if (!parsed.useGitDiff && !parsed.targetPath) {
    throw new CliCommandError("usage", "Provide a diff file path or use --git-diff.");
  }

  if (parsed.command === "quote" && parsed.saveReceiptPath) {
    throw new CliCommandError("usage", "--save-receipt can only be used with inspect.");
  }

  return parsed;
}

function readDiffInput(args: ParsedArgs): string {
  if (args.useGitDiff) {
    return readCurrentGitDiff();
  }

  const targetPath = path.resolve(process.cwd(), args.targetPath!);
  if (!fs.existsSync(targetPath)) {
    throw new CliCommandError("input", `Diff file not found: ${targetPath}`);
  }

  const diff = fs.readFileSync(targetPath, "utf8");
  if (!diff.trim()) {
    throw new CliCommandError("input", `Diff file is empty: ${targetPath}`);
  }

  return diff;
}

function readCurrentGitDiff(): string {
  try {
    const diff = execFileSync("git", ["diff", "--no-ext-diff", "--binary"], {
      cwd: process.cwd(),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });

    if (!diff.trim()) {
      throw new CliCommandError("input", "No current git diff found.");
    }

    return diff;
  } catch (error) {
    if (error instanceof CliCommandError) {
      throw error;
    }

    throw new CliCommandError(
      "input",
      "Unable to read the current git diff.",
      error instanceof Error ? error.message : String(error),
    );
  }
}

function maybeSaveReceipt(savePath: string | undefined, result: SigillumInspectResult): string | undefined {
  if (!savePath) {
    return undefined;
  }

  const resolvedPath = path.resolve(process.cwd(), savePath);
  fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });
  fs.writeFileSync(resolvedPath, `${JSON.stringify(result.receipt, null, 2)}\n`, "utf8");
  return resolvedPath;
}

function renderQuoteOutput(quote: Quote, asJson: boolean) {
  if (asJson) {
    console.log(
      JSON.stringify(
        {
          quote,
          payment: null,
          receipt: null,
          agent_decision: null,
        },
        null,
        2,
      ),
    );
    return;
  }

  console.log("SIGILLUM QUOTE");
  console.log(`quote_id=${quote.quote_id}`);
  console.log(`amount=${quote.amount} ${quote.currency}`);
  console.log(`expires_at=${quote.expires_at}`);
  console.log(`changed_lines=${quote.inspected_units.changed_lines}`);
}

function renderInspectOutput(
  result: SigillumInspectResult,
  asJson: boolean,
  savedReceiptPath?: string,
) {
  if (asJson) {
    console.log(
      JSON.stringify(
        {
          quote: result.quote,
          payment: result.payment,
          receipt: result.receipt,
          agent_decision: result.agent_decision,
        },
        null,
        2,
      ),
    );
    return;
  }

  console.log("SIGILLUM RECEIPT");
  console.log(`quote_id=${result.quote.quote_id}`);
  console.log(`amount=${result.quote.amount} ${result.quote.currency}`);
  console.log(`payment_mode=${result.payment.mode}`);
  console.log(`payment_rail=${result.payment.rail}`);
  if (result.payment.transaction) {
    console.log(`payment_tx=${result.payment.transaction}`);
  }
  if (result.payment.payment_reference) {
    console.log(`payment_ref=${result.payment.payment_reference}`);
  }
  console.log(`receipt_id=${result.receipt.receipt_id}`);
  console.log(`sigillum_risk_score=${result.receipt.score}`);
  console.log(`recommendation=${result.receipt.recommendation}`);
  console.log(`agent_decision=${result.agent_decision.agent_decision}`);
  if (savedReceiptPath) {
    console.log(`receipt_saved=${savedReceiptPath}`);
  }
}

function exitCodeForRecommendation(
  recommendation: SigillumRecommendation,
  failOnWarn: boolean,
): 0 | 1 | 2 {
  if (recommendation === "block") {
    return 2;
  }

  if (recommendation === "warn" && failOnWarn) {
    return 1;
  }

  return 0;
}

function renderFailure(error: unknown) {
  if (isCliErrorShape(error)) {
    console.error("SIGILLUM ERROR");
    console.error(`phase=${error.phase}`);
    console.error(`summary=${error.message}`);
    if (error.detail) {
      console.error(`detail=${error.detail}`);
    }
    process.exitCode = error.exitCode;
    return;
  }

  console.error("SIGILLUM ERROR");
  console.error("phase=runtime");
  console.error(`summary=${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 3;
}

async function loadCliClientModule() {
  return import(new URL("../src/lib/sigillum/cli-client.ts", import.meta.url).href);
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

void main();
