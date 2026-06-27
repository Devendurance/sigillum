import * as fs from "node:fs";
import * as path from "node:path";
import postgres from "postgres";
import { CHAIN_CONFIGS } from "@circle-fin/x402-batching/client";
import { createPublicClient, http, parseAbiItem } from "viem";
import { defineChain } from "viem";

loadEnvFiles();

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
    and transaction_hash is null
  order by created_at desc
`;

let resolvedCount = 0;
for (const event of paymentEvents) {
  if (!event.payment_reference) {
    continue;
  }

  const transactionHash = await resolveTransactionHash(event.payment_reference);
  if (!transactionHash) {
    continue;
  }

  await sql`
    update payment_events
    set transaction_hash = ${transactionHash}
    where id = ${event.id}
  `;

  resolvedCount += 1;
  console.log(
    JSON.stringify({
      payment_event_id: event.id,
      payment_reference: event.payment_reference,
      transaction_hash: transactionHash,
    }),
  );
}

console.log(
  JSON.stringify({
    scanned: paymentEvents.length,
    resolved: resolvedCount,
    unresolved: paymentEvents.length - resolvedCount,
  }),
);

await sql.end({ timeout: 5 });

async function resolveTransactionHash(paymentReference: string): Promise<string | null> {
  if (isExplorerTransactionHash(paymentReference)) {
    return paymentReference;
  }

  const transfer = await fetchGatewayTransfer(paymentReference);
  if (!transfer) {
    return null;
  }

  const payloadHash = readCandidateHash(transfer);
  if (payloadHash) {
    return payloadHash;
  }

  return resolveTransferHashFromArcLogs(transfer);
}

async function fetchGatewayTransfer(paymentReference: string): Promise<Record<string, unknown> | null> {
  const network = getSigillumX402Network();
  const baseUrl = network.toLowerCase().includes("testnet")
    ? "https://gateway-api-testnet.circle.com/v1"
    : "https://gateway-api.circle.com/v1";

  const response = await fetch(`${baseUrl}/x402/transfers/${encodeURIComponent(paymentReference)}`, {
    method: "GET",
    headers: {
      Accept: "application/json",
      ...getCircleGatewayAuthHeaders(),
    },
    cache: "no-store",
  }).catch(() => null);

  if (!response || !response.ok) {
    return null;
  }

  return (await response.json()) as Record<string, unknown>;
}

function readCandidateHash(record: Record<string, unknown>): string | null {
  for (const key of [
    "transactionHash",
    "txHash",
    "hash",
    "destinationTxHash",
    "sourceTxHash",
    "transferTxHash",
    "settlementTxHash",
  ]) {
    const candidate = record[key];
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
  const resourceNetwork = getSigillumX402ResourceNetwork();
  if (typeof network === "string" && network !== resourceNetwork) {
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
  const event = parseAbiItem("event Transfer(address indexed from, address indexed to, uint256 value)");

  for (const args of [
    { from: fromAddress ?? undefined, to: toAddress, value: amount },
    { to: toAddress, value: amount },
    { from: fromAddress ?? undefined, to: toAddress },
  ]) {
    const logs = await client.getLogs({
      address: chainConfig.usdc as `0x${string}`,
      event,
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

function isExplorerTransactionHash(value: string | null | undefined): value is `0x${string}` {
  return typeof value === "string" && /^0x[a-fA-F0-9]{64}$/.test(value.trim());
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
