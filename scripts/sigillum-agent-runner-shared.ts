import * as fs from "node:fs";
import * as path from "node:path";

const DEFAULT_BASE_URL = "http://localhost:3000";

export type RunnerCommonArgs = {
  baseUrl: string;
  mode: {
    once: boolean;
    intervalMs?: number;
    maxRuns?: number;
  };
};

export async function loadRunnerModules() {
  const cliClient = await import(new URL("../src/lib/sigillum/cli-client.ts", import.meta.url).href);
  return { cliClient };
}

export async function loadRunnerEnv() {
  const { cliClient } = await loadRunnerModules();
  cliClient.loadSigillumEnvFiles({ fs, path });
}

export function parseRunnerCommonArgs(argv: string[]): RunnerCommonArgs {
  const parsed: RunnerCommonArgs = {
    baseUrl: readEnvFromProcess("SIGILLUM_BASE_URL", "X402_API_BASE_URL") || DEFAULT_BASE_URL,
    mode: {
      once: true,
    },
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    const next = argv[index + 1];

    if (token === "--loop") {
      parsed.mode.once = false;
      continue;
    }

    if (token === "--once") {
      parsed.mode.once = true;
      continue;
    }

    if (token === "--interval-ms" && next) {
      parsed.mode.once = false;
      parsed.mode.intervalMs = Number.parseInt(next, 10);
      index += 1;
      continue;
    }

    if (token === "--max-runs" && next) {
      parsed.mode.maxRuns = Number.parseInt(next, 10);
      index += 1;
      continue;
    }

    if (token === "--base-url" && next) {
      parsed.baseUrl = next;
      index += 1;
    }
  }

  if (!parsed.mode.once && (!parsed.mode.intervalMs || parsed.mode.intervalMs <= 0)) {
    parsed.mode.intervalMs = 30000;
  }

  return parsed;
}

export async function runNamedAgent({
  agentName,
  baseUrl,
  mode,
  actionFactory,
}: {
  agentName: string;
  baseUrl: string;
  mode: {
    once: boolean;
    intervalMs?: number;
    maxRuns?: number;
  };
  actionFactory: () => Promise<unknown> | unknown;
}) {
  const { cliClient } = await loadRunnerModules();
  const client = cliClient.createSigillumClient({
    agentName,
    baseUrl,
  });

  const executeOnce = async () => {
    const envelope = await actionFactory();
    const result = await client.inspectAction({
      envelope,
    });
    renderAgentResult(agentName, result, envelope as { action_type: string });
    return result;
  };

  if (mode.once || !mode.intervalMs || mode.intervalMs <= 0) {
    return [await executeOnce()];
  }

  const results = [];
  while (mode.maxRuns === undefined || results.length < mode.maxRuns) {
    results.push(await executeOnce());
    await sleep(mode.intervalMs);
  }

  return results;
}

function renderAgentResult(
  agentName: string,
  result: {
    quote: { action_id: string; quote_id: string; amount: string; currency: string };
    payment: { mode: string; rail: string; payment_reference?: string; transaction_hash?: string };
    receipt: { receipt_id: string; score: number; recommendation: string };
    agent_decision: { agent_decision: string };
  },
  envelope: { action_type: string },
) {
  console.log("SIGILLUM AGENT RESULT");
  console.log(`agent=${agentName}`);
  console.log(`action_type=${envelope.action_type}`);
  console.log(`action_id=${result.quote.action_id}`);
  console.log(`quote_id=${result.quote.quote_id}`);
  console.log(`amount=${result.quote.amount} ${result.quote.currency}`);
  console.log(`payment_mode=${result.payment.mode}`);
  console.log(`payment_rail=${result.payment.rail}`);
  if (result.payment.payment_reference) {
    console.log(`payment_ref=${result.payment.payment_reference}`);
  }
  if (result.payment.transaction_hash) {
    console.log(`payment_tx=${result.payment.transaction_hash}`);
  }
  console.log(`receipt_id=${result.receipt.receipt_id}`);
  console.log(`sigillum_risk_score=${result.receipt.score}`);
  console.log(`recommendation=${result.receipt.recommendation}`);
  console.log(`agent_decision=${result.agent_decision.agent_decision}`);
}

function readEnvFromProcess(...keys: string[]) {
  for (const key of keys) {
    const value = process.env[key]?.trim();
    if (value) {
      return value;
    }
  }

  return undefined;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
