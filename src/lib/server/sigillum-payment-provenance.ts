import { createPublicClient, http, parseAbiItem } from "viem";
import { defineChain } from "viem";
import { CHAIN_CONFIGS } from "@circle-fin/x402-batching/client";
import type {
  SigillumSettlementProof,
  SigillumSettlementScope,
  SigillumSettlementSource,
  SigillumSettlementStatus,
} from "@/lib/sigillum/payment/types";
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
  transactionHash?: unknown;
  txHash?: unknown;
  hash?: unknown;
  destinationTxHash?: unknown;
  sourceTxHash?: unknown;
  transferTxHash?: unknown;
  settlementTxHash?: unknown;
  batchReference?: unknown;
  batchId?: unknown;
  settlementBatchId?: unknown;
  [key: string]: unknown;
};

type ResolveSettlementProofOptions = {
  paymentReference: string;
  source?: SigillumSettlementSource;
};

export async function resolveSigillumSettlementProof({
  paymentReference,
  source = "gateway_api",
}: ResolveSettlementProofOptions): Promise<SigillumSettlementProof> {
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

  logSigillumInfo("payment_provenance.lookup_started", {
    payment_reference: paymentReference,
  });

  const transfer = await fetchGatewayTransfer(paymentReference);
  if (!transfer) {
    logSigillumInfo("payment_provenance.transfer_not_found", {
      payment_reference: paymentReference,
    });

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

  logSigillumInfo("payment_provenance.transfer_found", {
    payment_reference: paymentReference,
    transfer_status: typeof transfer.status === "string" ? transfer.status : null,
  });

  const normalized = normalizeGatewayTransfer(transfer, checkedAt);
  if (normalized.transaction_hash) {
    logSigillumInfo("payment_provenance.authoritative_hash_found", {
      payment_reference: paymentReference,
      transaction_hash: normalized.transaction_hash,
      settlement_scope: normalized.settlement_scope,
    });
    return normalized;
  }

  if (!shouldAttemptArcLogResolution(transfer, normalized.settlement_status)) {
    if (normalized.batch_reference) {
      logSigillumInfo("payment_provenance.batch_detected_without_hash", {
        payment_reference: paymentReference,
        batch_reference: normalized.batch_reference,
      });
    } else {
      logSigillumInfo("payment_provenance.unresolved_without_chain_attempt", {
        payment_reference: paymentReference,
        settlement_status: normalized.settlement_status,
      });
    }

    return normalized;
  }

  const chainHash = await resolveTransferHashFromArcLogs(transfer);
  if (!chainHash) {
    logSigillumInfo("payment_provenance.proof_unresolved", {
      payment_reference: paymentReference,
      settlement_status: normalized.settlement_status,
      settlement_scope: normalized.settlement_scope,
    });
    return normalized;
  }

  logSigillumInfo("payment_provenance.arc_hash_resolved", {
    payment_reference: paymentReference,
    transaction_hash: chainHash,
    batch_reference: normalized.batch_reference,
  });

  return {
    ...normalized,
    transaction_hash: chainHash,
    settlement_source: "arc_log_resolution",
    settlement_status:
      normalized.settlement_scope === "batch" ? "batched" : "completed",
  };
}

export async function resolveSigillumTransactionHash(paymentReference: string): Promise<string | null> {
  const proof = await resolveSigillumSettlementProof({ paymentReference });
  return proof.transaction_hash;
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

function normalizeGatewayTransfer(
  transfer: GatewayTransferRecord,
  checkedAt: string,
): SigillumSettlementProof {
  const rawStatus = typeof transfer.status === "string" ? transfer.status : "";
  const normalizedStatus = rawStatus.trim().toLowerCase();
  const batchReference = readBatchReference(transfer);
  const authoritativeHash = readCandidateHash(transfer);
  const transactionConfirmedAt =
    readTimestampIso(transfer.updatedAt) ??
    readTimestampIso(transfer.createdAt) ??
    null;

  return {
    payment_reference: transfer.id,
    transaction_hash: authoritativeHash,
    settlement_status: deriveSettlementStatus(normalizedStatus, authoritativeHash, batchReference),
    settlement_scope: deriveSettlementScope(batchReference, authoritativeHash),
    settlement_source: authoritativeHash ? "gateway_transfer_payload" : "gateway_api",
    transaction_confirmed_at: authoritativeHash ? transactionConfirmedAt : null,
    batch_reference: batchReference,
    gateway_transfer_json: transfer,
    settlement_last_checked_at: checkedAt,
  };
}

function deriveSettlementStatus(
  normalizedStatus: string,
  authoritativeHash: string | null,
  batchReference: string | null,
): SigillumSettlementStatus {
  if (
    normalizedStatus.includes("fail") ||
    normalizedStatus.includes("error") ||
    normalizedStatus.includes("reject")
  ) {
    return "failed";
  }

  if (authoritativeHash) {
    return batchReference ? "batched" : "completed";
  }

  if (normalizedStatus.includes("batch")) {
    return "batched";
  }

  if (
    normalizedStatus.includes("complete") ||
    normalizedStatus.includes("settled") ||
    normalizedStatus.includes("success") ||
    normalizedStatus.includes("succeeded")
  ) {
    return batchReference ? "batched" : "completed";
  }

  if (normalizedStatus.includes("confirm")) {
    return "confirmed";
  }

  if (normalizedStatus.length > 0 || batchReference) {
    return "gateway_received";
  }

  return "unresolved";
}

function deriveSettlementScope(
  batchReference: string | null,
  authoritativeHash: string | null,
): SigillumSettlementScope {
  if (batchReference) {
    return "batch";
  }

  if (authoritativeHash) {
    return "individual";
  }

  return "unknown";
}

function shouldAttemptArcLogResolution(
  transfer: GatewayTransferRecord,
  status: SigillumSettlementStatus,
) {
  return (
    transfer.token === "USDC" &&
    (status === "batched" || status === "confirmed" || status === "completed")
  );
}

function readBatchReference(record: GatewayTransferRecord) {
  for (const candidate of [
    record.batchReference,
    record.batchId,
    record.settlementBatchId,
  ]) {
    if (typeof candidate === "string" && candidate.trim().length > 0) {
      return candidate.trim();
    }
  }

  return null;
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

      if (hashes.length > 1) {
        logSigillumInfo("payment_provenance.arc_log_ambiguous", {
          payment_reference: transfer.id,
          candidate_hash_count: hashes.length,
        });
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

function readTimestampIso(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
}
