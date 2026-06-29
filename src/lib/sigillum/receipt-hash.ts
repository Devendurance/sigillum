import { createHash } from "node:crypto";
import type { SigillumReceipt } from "./types";
import type { SigillumPublicReceipt } from "./types";

export function createSigillumReceiptHash(receipt: SigillumReceipt) {
  const canonical = canonicalizeValue(receipt);
  return `sha256:${createHash("sha256").update(canonical).digest("hex")}`;
}

export function createSigillumPublicReceiptHash(receipt: Omit<SigillumPublicReceipt, "receipt_hash">) {
  const canonical = canonicalizeValue(receipt);
  return `sha256:${createHash("sha256").update(canonical).digest("hex")}`;
}

function canonicalizeValue(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((entry) => canonicalizeValue(entry)).join(",")}]`;
  }

  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalizeValue(record[key])}`)
    .join(",")}}`;
}
