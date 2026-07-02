import { GatewayClient, type SupportedChainName } from "@circle-fin/x402-batching/client";
import type { AgentDecision, QuoteResponse, SigillumReceipt } from "./types.ts";
import type { PaymentRequirement } from "./payment/types.ts";
import type {
  SigillumActionEnvelope,
  SigillumCodeChangeEnvelope,
  SigillumDependencyInstallEnvelope,
  SigillumDeployActionEnvelope,
} from "./lifecycle.ts";

type HexString = `0x${string}`;
type AddressString = `0x${string}`;

export type SigillumCliPaymentSummary = {
  amount: string;
  mode: "demo" | "x402" | "unknown";
  rail: "local-demo" | "x402" | "unknown";
  payment_reference?: string;
  transaction_hash?: string;
  settlement_status?: string | null;
  settlement_scope?: string | null;
  settlement_source?: string | null;
  transaction_confirmed_at?: string | null;
  batch_reference?: string | null;
  requirement?: PaymentRequirement;
};

export type SigillumInspectResult = {
  quote: QuoteResponse;
  payment: SigillumCliPaymentSummary;
  receipt: SigillumReceipt;
  agent_decision: AgentDecision;
};

export type SigillumBalanceSnapshot = {
  role: "buyer" | "seller";
  address: AddressString;
  chain: SupportedChainName;
  rpcUrl: string;
  wallet: {
    formatted: string;
  };
  gateway:
    | {
        total: string;
        available: string;
        withdrawing: string;
        withdrawable: string;
      }
    | null;
  gatewayStatusMessage: string;
};

type InspectSuccess = {
  action_id?: string;
  receipt: SigillumReceipt;
  agent_decision: AgentDecision;
  payment?: {
    mode?: "demo" | "x402";
    rail?: "local-demo" | "x402";
    payment_reference?: string;
    transaction_hash?: string;
    settlement_status?: string | null;
    settlement_scope?: string | null;
    settlement_source?: string | null;
    transaction_confirmed_at?: string | null;
    batch_reference?: string | null;
  };
};

type InspectFailureBody = {
  message?: string;
  payment?: PaymentRequirement;
  reason?: string;
  error?: string;
};

type CreateSigillumClientOptions = {
  baseUrl: string;
  allowDemoConfirm?: boolean;
  agentName?: string;
};

type InspectDiffOptions = {
  diff: string;
  allowDemoConfirm?: boolean;
  repo?: string;
  branch?: string;
  commitSha?: string;
};

type InspectActionOptions = {
  envelope: SigillumActionEnvelope;
  allowDemoConfirm?: boolean;
};

type InspectQuotedActionOptions = {
  envelope: SigillumActionEnvelope;
  quote: QuoteResponse;
  allowDemoConfirm?: boolean;
};

export class SigillumCliError extends Error {
  readonly exitCode: 3;
  readonly phase: string;
  readonly detail?: string;

  constructor(phase: string, summary: string, detail?: string) {
    super(summary);
    this.name = "SigillumCliError";
    this.exitCode = 3;
    this.phase = phase;
    this.detail = detail;
  }
}

export function createSigillumClient(options: CreateSigillumClientOptions) {
  const baseUrl = normalizeBaseUrl(options.baseUrl);

  async function quoteAction(envelope: SigillumActionEnvelope): Promise<QuoteResponse> {
    const response = await postJson(`${baseUrl}/api/quote`, envelope);
    if (!response.ok) {
      throw new SigillumCliError("quote", `Quote request failed with HTTP ${response.status}.`);
    }

    return (await response.json()) as QuoteResponse;
  }

  async function inspectAction({
    envelope,
    allowDemoConfirm = options.allowDemoConfirm ?? true,
  }: InspectActionOptions): Promise<SigillumInspectResult> {
    const quote = await quoteAction(envelope);
    return inspectQuotedAction({
      envelope,
      quote,
      allowDemoConfirm,
    });
  }

  async function inspectQuotedAction({
    envelope,
    quote,
    allowDemoConfirm = options.allowDemoConfirm ?? true,
  }: InspectQuotedActionOptions): Promise<SigillumInspectResult> {
    const inspectUrl = `${baseUrl}/api/inspect`;
    const firstInspectResponse = await postJson(inspectUrl, {
      ...envelope,
      action_id: quote.action_id,
      quote_id: quote.quote_id,
    });

    if (firstInspectResponse.ok) {
      const result = (await firstInspectResponse.json()) as InspectSuccess;
      return toInspectResult({
        quote,
        result,
        payment: {
          amount: quote.amount,
          mode: result.payment?.mode ?? "unknown",
          rail: result.payment?.rail ?? "unknown",
          payment_reference: result.payment?.payment_reference,
          transaction_hash: normalizeTransactionHash(result.payment?.transaction_hash),
          settlement_status: result.payment?.settlement_status ?? null,
          settlement_scope: result.payment?.settlement_scope ?? null,
          settlement_source: result.payment?.settlement_source ?? null,
          transaction_confirmed_at: result.payment?.transaction_confirmed_at ?? null,
          batch_reference: result.payment?.batch_reference ?? null,
        },
      });
    }

    const firstInspectBody = (await safeJson(firstInspectResponse)) as InspectFailureBody | null;
    if (firstInspectResponse.status !== 402) {
      throw new SigillumCliError(
        "inspect",
        `Inspect request failed with HTTP ${firstInspectResponse.status}.`,
        readReason(firstInspectBody) ?? undefined,
      );
    }

    const declaredMode =
      readHeader(firstInspectResponse, "x-sigillum-payment-mode") ??
      readNestedString(firstInspectBody, "payment", "mode") ??
      "unknown";

    if (declaredMode === "demo") {
      if (!allowDemoConfirm) {
        throw new SigillumCliError(
          "payment",
          "Server is in demo payment mode.",
          "Rerun with demo confirmation enabled or switch the server to x402 mode.",
        );
      }

      const demoResponse = await postJson(inspectUrl, {
        ...envelope,
        action_id: quote.action_id,
        quote_id: quote.quote_id,
        payment_confirmed: true,
        payment_proof: "sigillum-cli-demo-confirmation",
      });

      if (!demoResponse.ok) {
        const demoBody = (await safeJson(demoResponse)) as InspectFailureBody | null;
        throw new SigillumCliError(
          "payment",
          `Demo payment confirmation failed with HTTP ${demoResponse.status}.`,
          readReason(demoBody) ?? undefined,
        );
      }

      const result = (await demoResponse.json()) as InspectSuccess;
      return toInspectResult({
        quote,
        result,
        payment: {
          amount: quote.amount,
          mode: result.payment?.mode ?? "demo",
          rail: result.payment?.rail ?? "local-demo",
          payment_reference: result.payment?.payment_reference,
          transaction_hash: normalizeTransactionHash(result.payment?.transaction_hash),
          settlement_status: result.payment?.settlement_status ?? null,
          settlement_scope: result.payment?.settlement_scope ?? null,
          settlement_source: result.payment?.settlement_source ?? null,
          transaction_confirmed_at: result.payment?.transaction_confirmed_at ?? null,
          batch_reference: result.payment?.batch_reference ?? null,
          requirement: firstInspectBody?.payment,
        },
      });
    }

    const gateway = await createGatewayClientFromEnv();
    const autoDepositAmount = readEnv("X402_BUYER_AUTO_DEPOSIT_USDC");

    if (autoDepositAmount) {
      await gateway.deposit(autoDepositAmount);
    }

    try {
      const paidResult = (await gateway.pay(inspectUrl, {
        method: "POST",
        body: {
          ...envelope,
          action_id: quote.action_id,
          quote_id: quote.quote_id,
        },
        headers: {
          "Content-Type": "application/json",
        },
      })) as { data: InspectSuccess; transaction: string };

      return toInspectResult({
        quote,
        result: paidResult.data,
        payment: {
          amount: quote.amount,
          mode: paidResult.data.payment?.mode ?? "x402",
          rail: paidResult.data.payment?.rail ?? "x402",
          payment_reference: paidResult.data.payment?.payment_reference,
          transaction_hash:
            normalizeTransactionHash(paidResult.data.payment?.transaction_hash) ??
            normalizeTransactionHash(paidResult.transaction),
          settlement_status: paidResult.data.payment?.settlement_status ?? null,
          settlement_scope: paidResult.data.payment?.settlement_scope ?? null,
          settlement_source: paidResult.data.payment?.settlement_source ?? null,
          transaction_confirmed_at: paidResult.data.payment?.transaction_confirmed_at ?? null,
          batch_reference: paidResult.data.payment?.batch_reference ?? null,
          requirement: firstInspectBody?.payment,
        },
      });
    } catch (error) {
      throw new SigillumCliError(
        "payment",
        "x402 payment flow failed.",
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  async function quote(diff: string): Promise<QuoteResponse> {
    return quoteAction(buildCodeChangeEnvelope(diff, options.agentName));
  }

  async function inspectDiff({
    diff,
    allowDemoConfirm = options.allowDemoConfirm ?? true,
    repo,
    branch,
    commitSha,
  }: InspectDiffOptions): Promise<SigillumInspectResult> {
    return inspectAction({
      envelope: buildCodeChangeEnvelope(diff, options.agentName, { repo, branch, commitSha }),
      allowDemoConfirm,
    });
  }

  return {
    quote,
    quoteAction,
    inspectDiff,
    inspectAction,
    inspectQuotedAction,
  };
}

export function loadSigillumEnvFiles({
  fs,
  path,
  searchDirs,
}: {
  fs: typeof import("node:fs");
  path: typeof import("node:path");
  searchDirs?: string[];
}) {
  const directories = Array.from(
    new Set([...(searchDirs ?? []), process.cwd()].map((dir) => path.resolve(dir))),
  );

  for (const directory of directories) {
    for (const fileName of [".env.local", ".env"]) {
      const filePath = path.join(directory, fileName);
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
}

export function readEnv(...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = process.env[key]?.trim();
    if (value) {
      return value;
    }
  }

  return undefined;
}

export async function getSigillumBalanceSnapshot(
  role: "buyer" | "seller",
): Promise<SigillumBalanceSnapshot> {
  const gateway = await createGatewayClientFromEnv({
    phase: "balance",
    requireRpcUrl: true,
  });
  const targetAddress =
    role === "buyer" ? gateway.address : readRequiredSigillumAddress("X402_SELLER_WALLET_ADDRESS", "X402_SELLER_ADDRESS");

  const wallet = await gateway.getUsdcBalance(targetAddress);

  try {
    const balances = await gateway.getBalances(targetAddress);
    return {
      role,
      address: targetAddress,
      chain: gateway.getChainName(),
      rpcUrl: readRequiredEnv(
        "balance",
        "X402_RPC_URL",
        "SIGILLUM_BUYER_RPC_URL",
      ),
      wallet: {
        formatted: balances.wallet.formatted,
      },
      gateway: {
        total: balances.gateway.formattedTotal,
        available: balances.gateway.formattedAvailable,
        withdrawing: balances.gateway.formattedWithdrawing,
        withdrawable: balances.gateway.formattedWithdrawable,
      },
      gatewayStatusMessage: "Gateway balance available.",
    };
  } catch (error) {
    if (isMissingGatewayBalanceError(error)) {
      return {
        role,
        address: targetAddress,
        chain: gateway.getChainName(),
        rpcUrl: readRequiredEnv(
          "balance",
          "X402_RPC_URL",
          "SIGILLUM_BUYER_RPC_URL",
        ),
        wallet: {
          formatted: wallet.formatted,
        },
        gateway: null,
        gatewayStatusMessage:
          "No Gateway balance found yet for this address. Deposit USDC into Gateway and retry after the provider updates the ledger.",
      };
    }

    throw new SigillumCliError(
      "balance",
      "Failed to fetch Gateway balance.",
      error instanceof Error ? error.message : String(error),
    );
  }
}

function toInspectResult({
  quote,
  result,
  payment,
}: {
  quote: QuoteResponse;
  result: InspectSuccess;
  payment: SigillumCliPaymentSummary;
}): SigillumInspectResult {
  return {
    quote,
    payment,
    receipt: result.receipt,
    agent_decision: result.agent_decision,
  };
}

export function buildCodeChangeEnvelope(
  diff: string,
  agentName = "Sigillum CLI",
  metadata?: {
    repo?: string;
    branch?: string;
    commitSha?: string;
  },
): SigillumCodeChangeEnvelope {
  return {
    agent: {
      name: agentName,
      type: "cli",
    },
    action_type: "code_change",
    action_input: {
      diff,
      ...(metadata?.repo ? { repo: metadata.repo } : {}),
      ...(metadata?.branch ? { branch: metadata.branch } : {}),
      ...(metadata?.commitSha ? { commit_sha: metadata.commitSha } : {}),
    },
  };
}

export function buildDependencyInstallEnvelope(
  input: SigillumDependencyInstallEnvelope["action_input"],
  agentName = "DependencyInstallAgent",
): SigillumDependencyInstallEnvelope {
  return {
    agent: {
      name: agentName,
      type: "runner",
    },
    action_type: "dependency_install",
    action_input: input,
  };
}

export function buildDeployActionEnvelope(
  input: SigillumDeployActionEnvelope["action_input"],
  agentName = "DeployActionAgent",
): SigillumDeployActionEnvelope {
  return {
    agent: {
      name: agentName,
      type: "runner",
    },
    action_type: "deploy_action",
    action_input: input,
  };
}

async function createGatewayClientFromEnv(options?: {
  phase?: "payment" | "balance";
  requireRpcUrl?: boolean;
}) {
  const phase = options?.phase ?? "payment";
  const privateKey = readEnv("SIGILLUM_BUYER_PRIVATE_KEY", "X402_BUYER_PRIVATE_KEY");
  if (!privateKey) {
    throw new SigillumCliError(
      phase,
      phase === "payment"
        ? "Buyer private key is required for the x402 payment flow."
        : "A private key is required to query balances through the Gateway client.",
      phase === "payment"
        ? "Set X402_BUYER_PRIVATE_KEY or SIGILLUM_BUYER_PRIVATE_KEY."
        : "Set X402_BUYER_PRIVATE_KEY or SIGILLUM_BUYER_PRIVATE_KEY. A seller private key is not required for seller-side read-only checks.",
    );
  }

  const chain = (readEnv("SIGILLUM_BUYER_CHAIN", "X402_NETWORK") || "arcTestnet") as SupportedChainName;
  const rpcUrl = options?.requireRpcUrl
    ? readRequiredEnv(phase, "SIGILLUM_BUYER_RPC_URL", "X402_RPC_URL")
    : readEnv("SIGILLUM_BUYER_RPC_URL", "X402_RPC_URL");

  return new GatewayClient({
    chain,
    privateKey: privateKey as HexString,
    ...(rpcUrl ? { rpcUrl } : {}),
  });
}

function normalizeBaseUrl(value: string): string {
  return value.replace(/\/+$/, "");
}

async function postJson(url: string, body: unknown): Promise<Response> {
  try {
    return await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
  } catch (error) {
    throw new SigillumCliError(
      "runtime",
      `Could not reach the Sigillum API at ${url}.`,
      [
        `Check X402_API_BASE_URL or SIGILLUM_BASE_URL in .env.local.`,
        `If the URL is correct, make sure the Next.js app is running and that server-side env such as DATABASE_URL, SUPABASE_URL, and SUPABASE_SERVICE_ROLE_KEY are present so the API can boot successfully.`,
        `Underlying error: ${error instanceof Error ? error.message : String(error)}`,
      ].join(" "),
    );
  }
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

function readReason(body: InspectFailureBody | null): string | undefined {
  if (!body || typeof body !== "object") {
    return undefined;
  }

  return body.reason ?? body.message ?? body.error ?? body.payment?.message;
}

function readNestedString(
  value: InspectFailureBody | null,
  outerKey: "payment",
  innerKey: "mode" | "rail",
): string | undefined {
  if (!value?.[outerKey]) {
    return undefined;
  }

  const nestedValue = value[outerKey][innerKey];
  return typeof nestedValue === "string" ? nestedValue : undefined;
}

function normalizeTransactionHash(value: string | undefined) {
  return value && /^0x[a-fA-F0-9]{64}$/.test(value) ? value : undefined;
}

function readRequiredEnv(phase: string, ...keys: string[]) {
  const value = readEnv(...keys);
  if (value) {
    return value;
  }

  throw new SigillumCliError(
    phase,
    `Missing required environment value: ${keys[0]}.`,
    `Set one of: ${keys.join(", ")}.`,
  );
}

function readRequiredSigillumAddress(...keys: string[]) {
  const value = readRequiredEnv("balance", ...keys);
  if (/^0x[a-fA-F0-9]{40}$/.test(value)) {
    return value as AddressString;
  }

  throw new SigillumCliError(
    "balance",
    `Invalid address value for ${keys[0]}.`,
    `Expected a 0x-prefixed 40-hex-character address. Received: ${value}`,
  );
}

function isMissingGatewayBalanceError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  return (
    error.message.includes("returned no balances") ||
    error.message.includes("No Gateway balance found")
  );
}
