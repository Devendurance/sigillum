import type { SigillumPaymentMode } from "./types";

const DEFAULT_PAYMENT_MODE: SigillumPaymentMode = "demo";

export function getSigillumPaymentMode(): SigillumPaymentMode {
  const rawMode = process.env.SIGILLUM_PAYMENT_MODE?.trim().toLowerCase();

  if (rawMode === "x402") {
    return "x402";
  }

  return DEFAULT_PAYMENT_MODE;
}

export function isSigillumX402Configured(): boolean {
  return Boolean(process.env.X402_SELLER_WALLET_ADDRESS?.trim()) && Boolean(process.env.CIRCLE_GATEWAY_API_KEY?.trim());
}

