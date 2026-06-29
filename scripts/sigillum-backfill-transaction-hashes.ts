import * as fs from "node:fs";
import * as path from "node:path";
import postgres from "postgres";
import { createPublicClient, http, parseAbiItem } from "viem";
import { defineChain } from "viem";
import { CHAIN_CONFIGS } from "@circle-fin/x402-batching/client";

loadEnvFiles();
const transferEvent = parseAbiItem("event Transfer(address indexed from, address indexed to, uint256 value)");

const databaseUrl =
  readEnv("DATABASE_URL", "SIGILLUM_DATABASE_URL", "POSTGRES_URL", "SUPABASE_DB_URL");

if (!databaseUrl) {
  throw new Error("Missing DATABASE_URL-compatible environment variable for backfill.");
}

const sql = postgres(normalizePostgresConnectionString(databaseUrl), {
  max: 1,
  prepare: false,
});

const paymentEvents = await sql<{
  id: string;
  payment_reference: string | null;
}[]>`
  select id, payment_reference
  from payment_events
  where stage = 'payment_confirmed'
  order by created_at desc
`;

let resolvedCount = 0;
let updatedCount = 0;
for (const event of paymentEvents) {
  if (!event.payment_reference) {
    continue;
  }

  const proof = await resolveSigillumSettlementProof({
    paymentReference: event.payment_reference,
    source: "manual_backfill",
  });

  await sql`
    update payment_events
    set transaction_hash = ${proof.transaction_hash},
        settlement_status = ${proof.settlement_status},
        settlement_scope = ${proof.settlement_scope},
        settlement_source = ${proof.settlement_source},
        transaction_confirmed_at = ${proof.transaction_confirmed_at ? new Date(proof.transaction_confirmed_at) : null},
        gateway_transfer_json = ${proof.gateway_transfer_json ? JSON.stringify(proof.gateway_transfer_json) : null}::jsonb,
        batch_reference = ${proof.batch_reference},
        settlement_last_checked_at = ${new Date(proof.settlement_last_checked_at)}
    where id = ${event.id}
  `;

  updatedCount += 1;
  if (proof.transaction_hash) {
    resolvedCount += 1;
  }

  console.log(
    JSON.stringify({
      payment_event_id: event.id,
      payment_reference: event.payment_reference,
      transaction_hash: proof.transaction_hash,
      settlement_status: proof.settlement_status,
      settlement_scope: proof.settlement_scope,
      batch_reference: proof.batch_reference,
    }),
  );
}

console.log(
  JSON.stringify({
    scanned: paymentEvents.length,
    updated: updatedCount,
    resolved: resolvedCount,
    unresolved: updatedCount - resolvedCount,
  }),
);

await sql.end({ timeout: 5 });

function readEnv(...keys: string[]) {
  for (const key of keys) {
    const value = process.env[key]?.trim();
    if (value) {
      return value;
    }
  }

  return undefined;
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

function normalizePostgresConnectionString(connectionString: string): string {
  try {
    return new URL(connectionString).toString();
  } catch {
    const match = connectionString.match(/^(postgres(?:ql)?:\/\/)([^:/?#]+):([^@]+)@(.+)$/i);
    if (!match) {
      return connectionString;
    }

    const [, protocol, username, password, rest] = match;
    return `${protocol}${encodeURIComponent(username)}:${encodeURIComponent(password)}@${rest}`;
  }
}

async function resolveSigillumSettlementProof({
  paymentReference,
  source,
}: {
  paymentReference: string;
  source: "manual_backfill";
}) {
  const checkedAt = new Date().toISOString();

  if (isExplorerTransactionHash(paymentReference)) {
    return {
      payment_reference: paymentReference,
      transaction_hash: paymentReference,
      settlement_status: "completed",
      settlement_scope: "individual",
      settlement_source: source,
      transaction_confirmed_at: null,
      batch_reference: null,
      gateway_transfer_json: null,
      settlement_last_checked_at: checkedAt,
    };
  }

  const transfer = await fetchGatewayTransfer(paymentReference);
  if (!transfer) {
    return {
      payment_reference: paymentReference,
      transaction_hash: null,
      settlement_status: "unresolved",
      settlement_scope: "unknown",
      settlement_source: null,
      transaction_confirmed_at: null,
      batch_reference: null,
      gateway_transfer_json: null,
      settlement_last_checked_at: checkedAt,
    };
  }

  const normalized = normalizeGatewayTransfer(transfer, checkedAt);
  if (normalized.transaction_hash) {
    return normalized;
  }

  if (!shouldAttemptArcLogResolution(transfer, normalized.settlement_status)) {
    return normalized;
  }

  const chainHash = await resolveTransferHashFromArcLogs(transfer);
  if (!chainHash) {
    return normalized;
  }

  return {
    ...normalized,
    transaction_hash: chainHash,
    settlement_source: "arc_log_resolution",
    settlement_status: normalized.settlement_scope === "batch" ? "batched" : "completed",
  };
}

async function fetchGatewayTransfer(paymentReference: string): Promise<Record<string, unknown> | null> {
  const response = await fetch(
    `${getSigillumX402FacilitatorUrl()}/v1/x402/transfers/${encodeURIComponent(paymentReference)}`,
    {
      method: "GET",
      headers: {
        Accept: "application/json",
        ...getCircleGatewayAuthHeaders(),
      },
      cache: "no-store",
    },
  ).catch(() => null);

  if (!response || !response.ok) {
    return null;
  }

  return (await response.json()) as Record<string, unknown>;
}

function normalizeGatewayTransfer(transfer: Record<string, unknown>, checkedAt: string) {
  const status = typeof transfer.status === "string" ? transfer.status.trim().toLowerCase() : "";
  const batchReference = readBatchReference(transfer);
  const authoritativeHash = readCandidateHash(transfer);
  const transactionConfirmedAt =
    readTimestampIso(transfer.updatedAt) ??
    readTimestampIso(transfer.createdAt) ??
    null;

  return {
    payment_reference: String(transfer.id ?? ""),
    transaction_hash: authoritativeHash,
    settlement_status: deriveSettlementStatus(status, authoritativeHash, batchReference),
    settlement_scope: deriveSettlementScope(batchReference, authoritativeHash),
    settlement_source: authoritativeHash ? "gateway_transfer_payload" : "gateway_api",
    transaction_confirmed_at: authoritativeHash ? transactionConfirmedAt : null,
    batch_reference: batchReference,
    gateway_transfer_json: transfer,
    settlement_last_checked_at: checkedAt,
  };
}

function deriveSettlementStatus(status: string, authoritativeHash: string | null, batchReference: string | null) {
  if (status.includes("fail") || status.includes("error") || status.includes("reject")) {
    return "failed";
  }
  if (authoritativeHash) {
    return batchReference ? "batched" : "completed";
  }
  if (status.includes("batch")) {
    return "batched";
  }
  if (
    status.includes("complete") ||
    status.includes("settled") ||
    status.includes("success") ||
    status.includes("succeeded")
  ) {
    return batchReference ? "batched" : "completed";
  }
  if (status.includes("confirm")) {
    return "confirmed";
  }
  if (status.length > 0 || batchReference) {
    return "gateway_received";
  }
  return "unresolved";
}

function deriveSettlementScope(batchReference: string | null, authoritativeHash: string | null) {
  if (batchReference) {
    return "batch";
  }
  if (authoritativeHash) {
    return "individual";
  }
  return "unknown";
}

function shouldAttemptArcLogResolution(transfer: Record<string, unknown>, status: string) {
  return transfer.token === "USDC" && (status === "batched" || status === "confirmed" || status === "completed");
}

function readBatchReference(record: Record<string, unknown>) {
  for (const candidate of [record.batchReference, record.batchId, record.settlementBatchId]) {
    if (typeof candidate === "string" && candidate.trim().length > 0) {
      return candidate.trim();
    }
  }
  return null;
}

function readCandidateHash(record: Record<string, unknown>) {
  for (const candidate of [
    record.transactionHash,
    record.txHash,
    record.hash,
    record.destinationTxHash,
    record.sourceTxHash,
    record.transferTxHash,
    record.settlementTxHash,
  ]) {
    if (typeof candidate === "string" && isExplorerTransactionHash(candidate)) {
      return candidate;
    }
  }
  return null;
}

async function resolveTransferHashFromArcLogs(transfer: Record<string, unknown>) {
  if (transfer.token !== "USDC") {
    return null;
  }

  const network = typeof transfer.recipientNetwork === "string" ? transfer.recipientNetwork : transfer.sendingNetwork;
  if (typeof network === "string" && network !== getSigillumX402ResourceNetwork()) {
    return null;
  }

  const chainConfig = CHAIN_CONFIGS[getSigillumX402Network()];
  const rpcUrl = readEnv("X402_RPC_URL") ?? chainConfig.rpcUrl;
  if (!rpcUrl) {
    return null;
  }

  const toAddress = normalizeAddress(transfer.toAddress);
  const fromAddress = normalizeAddress(transfer.fromAddress);
  const amount = normalizeAmount(transfer.amount);
  const targetTimestamp = readTimestamp(transfer.updatedAt) ?? readTimestamp(transfer.createdAt);
  if (!toAddress || amount === null || !targetTimestamp) {
    return null;
  }

  const client = createPublicClient({
    chain: defineChain({
      ...chainConfig.chain,
      rpcUrls: {
        default: { http: [rpcUrl] },
        public: { http: [rpcUrl] },
      },
    }),
    transport: http(rpcUrl),
  });

  const anchorBlock = await findApproximateBlockNumber(client, targetTimestamp);
  const radius = BigInt(4000);
  const fromBlock = anchorBlock > radius ? anchorBlock - radius : BigInt(0);
  const toBlock = anchorBlock + radius;

  for (const args of [
    { from: fromAddress ?? undefined, to: toAddress, value: amount },
    { to: toAddress, value: amount },
    { from: fromAddress ?? undefined, to: toAddress },
  ]) {
    const logs = await client.getLogs({
      address: chainConfig.usdc as `0x${string}`,
      event: transferEvent,
      args,
      fromBlock,
      toBlock,
    });
    const hashes = [...new Set(logs.map((log) => log.transactionHash).filter(isExplorerTransactionHash))];
    if (hashes.length === 1) {
      return hashes[0];
    }
  }

  return null;
}

async function findApproximateBlockNumber(
  client: ReturnType<typeof createPublicClient>,
  targetTimestamp: number,
) {
  const latest = await client.getBlock({ blockTag: "latest" });
  const windowSize = BigInt(20000);
  let low = latest.number > windowSize ? latest.number - windowSize : BigInt(0);
  let high = latest.number;

  while (high - low > BigInt(1)) {
    const mid = low + (high - low) / BigInt(2);
    const block = await client.getBlock({ blockNumber: mid });
    const blockTimestamp = Number(block.timestamp);
    if (blockTimestamp < targetTimestamp) {
      low = mid;
    } else {
      high = mid;
    }
  }

  return high;
}

function getSigillumX402Network() {
  const rawNetwork = readEnv("X402_NETWORK");
  if (rawNetwork && rawNetwork in CHAIN_CONFIGS) {
    return rawNetwork as keyof typeof CHAIN_CONFIGS;
  }
  return "arcTestnet" as const;
}

function getSigillumX402ResourceNetwork() {
  return `eip155:${CHAIN_CONFIGS[getSigillumX402Network()].chain.id}`;
}

function getSigillumX402FacilitatorUrl() {
  return readEnv("X402_FACILITATOR_URL") ?? "https://gateway-api-testnet.circle.com";
}

function getCircleGatewayAuthHeaders(): Record<string, string> {
  const apiKey = readEnv("CIRCLE_GATEWAY_API_KEY");
  if (!apiKey) {
    return {};
  }

  return {
    Authorization: `Bearer ${apiKey}`,
    "X-API-Key": apiKey,
  };
}

function normalizeAddress(value: unknown) {
  return typeof value === "string" && /^0x[a-fA-F0-9]{40}$/.test(value) ? (value as `0x${string}`) : null;
}

function normalizeAmount(value: unknown) {
  if (typeof value !== "string" || !/^\d+$/.test(value)) {
    return null;
  }

  try {
    return BigInt(value);
  } catch {
    return null;
  }
}

function readTimestamp(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? Math.floor(timestamp / 1000) : null;
}

function readTimestampIso(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
}

function isExplorerTransactionHash(value: string | null | undefined): value is `0x${string}` {
  return typeof value === "string" && /^0x[a-fA-F0-9]{64}$/.test(value.trim());
}
