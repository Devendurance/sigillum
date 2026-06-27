import { createPublicClient, http, parseAbiItem } from "viem";
import { defineChain } from "viem";
import { CHAIN_CONFIGS } from "@circle-fin/x402-batching/client";
import {
  getCircleGatewayAuthHeaders,
  getSigillumX402FacilitatorUrl,
  getSigillumX402Network,
  getSigillumX402ResourceNetwork,
} from "../sigillum/payment/config";
import { logSigillumError, logSigillumInfo } from "./sigillum-log";

const transferEvent = parseAbiItem("event Transfer(address indexed from, address indexed to, uint256 value)");

type GatewayTransferRecord = {
  id: string;
  status?: string;
  token?: string;
  sendingNetwork?: string;
  recipientNetwork?: string;
  fromAddress?: string;
  toAddress?: string;
  amount?: string;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
};

export async function resolveSigillumTransactionHash(paymentReference: string): Promise<string | null> {
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

  const chainHash = await resolveTransferHashFromArcLogs(transfer);
  if (chainHash) {
    return chainHash;
  }

  return null;
}

export function isExplorerTransactionHash(value: string | null | undefined): value is `0x${string}` {
  return typeof value === "string" && /^0x[a-fA-F0-9]{64}$/.test(value.trim());
}

async function fetchGatewayTransfer(paymentReference: string): Promise<GatewayTransferRecord | null> {
  const baseUrl = `${getSigillumX402FacilitatorUrl()}/v1`;

  try {
    const response = await fetch(`${baseUrl}/x402/transfers/${encodeURIComponent(paymentReference)}`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        ...getCircleGatewayAuthHeaders(),
      },
      cache: "no-store",
    });

    if (!response.ok) {
      logSigillumInfo("payment_provenance.gateway_transfer_unavailable", {
        payment_reference: paymentReference,
        status: response.status,
      });
      return null;
    }

    return (await response.json()) as GatewayTransferRecord;
  } catch (error) {
    logSigillumError("payment_provenance.gateway_transfer_failed", error, {
      payment_reference: paymentReference,
    });
    return null;
  }
}

function readCandidateHash(record: GatewayTransferRecord): string | null {
  const candidates = [
    record.transactionHash,
    record.txHash,
    record.hash,
    record.destinationTxHash,
    record.sourceTxHash,
    record.transferTxHash,
    record.settlementTxHash,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "string" && isExplorerTransactionHash(candidate)) {
      return candidate;
    }
  }

  return null;
}

async function resolveTransferHashFromArcLogs(transfer: GatewayTransferRecord): Promise<string | null> {
  if (transfer.token !== "USDC") {
    return null;
  }

  const chainConfig = CHAIN_CONFIGS[getSigillumX402Network()];
  const rpcUrl = process.env.X402_RPC_URL?.trim() || chainConfig.rpcUrl;
  if (!rpcUrl) {
    return null;
  }

  const network = transfer.recipientNetwork ?? transfer.sendingNetwork;
  if (network && network !== getSigillumX402ResourceNetwork()) {
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
        default: {
          http: [rpcUrl],
        },
        public: {
          http: [rpcUrl],
        },
      },
    }),
    transport: http(rpcUrl),
  });

  try {
    const anchorBlock = await findApproximateBlockNumber(client, targetTimestamp);
    const searchRadius = BigInt(4000);
    const fromBlock = anchorBlock > searchRadius ? anchorBlock - searchRadius : BigInt(0);
    const toBlock = anchorBlock + searchRadius;
    const attempts = [
      { args: { from: fromAddress ?? undefined, to: toAddress, value: amount } },
      { args: { to: toAddress, value: amount } },
      { args: { from: fromAddress ?? undefined, to: toAddress } },
    ];

    for (const attempt of attempts) {
      const logs = await client.getLogs({
        address: chainConfig.usdc as `0x${string}`,
        event: transferEvent,
        args: attempt.args,
        fromBlock,
        toBlock,
      });

      const hashes = [...new Set(logs.map((log) => log.transactionHash).filter(isExplorerTransactionHash))];
      if (hashes.length === 1) {
        return hashes[0];
      }
    }

    logSigillumInfo("payment_provenance.arc_log_unresolved", {
      payment_reference: transfer.id,
      to_address: toAddress,
      from_address: fromAddress,
      amount: transfer.amount,
    });
    return null;
  } catch (error) {
    logSigillumError("payment_provenance.arc_log_failed", error, {
      payment_reference: transfer.id,
    });
    return null;
  }
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
