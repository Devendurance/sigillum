import { CHAIN_CONFIGS, type SupportedChainName } from "@circle-fin/x402-batching/client";
import type { SigillumPaymentMode } from "./types";

const DEFAULT_PAYMENT_MODE: SigillumPaymentMode = "demo";
const DEFAULT_X402_NETWORK: SupportedChainName = "arcTestnet";
const DEFAULT_X402_TESTNET_FACILITATOR_URL = "https://gateway-api-testnet.circle.com";
const DEFAULT_X402_MAINNET_FACILITATOR_URL = "https://gateway-api.circle.com";

export function getSigillumPaymentMode(): SigillumPaymentMode {
  const rawMode = process.env.SIGILLUM_PAYMENT_MODE?.trim().toLowerCase();

  if (rawMode === "x402") {
    return "x402";
  }

  return DEFAULT_PAYMENT_MODE;
}

export function getSigillumX402Network(): SupportedChainName {
  const rawNetwork = process.env.X402_NETWORK?.trim();

  if (!rawNetwork) {
    return DEFAULT_X402_NETWORK;
  }

  if (rawNetwork in CHAIN_CONFIGS) {
    return rawNetwork as SupportedChainName;
  }

  return DEFAULT_X402_NETWORK;
}

export function getSigillumX402ResourceNetwork(): `eip155:${number}` {
  return `eip155:${CHAIN_CONFIGS[getSigillumX402Network()].chain.id}`;
}

export function getSigillumX402SellerAddress(): string | null {
  const sellerAddress =
    process.env.X402_SELLER_WALLET_ADDRESS?.trim() ??
    process.env.X402_SELLER_ADDRESS?.trim();
  return sellerAddress && sellerAddress.length > 0 ? sellerAddress : null;
}

export function getSigillumX402FacilitatorUrl(): string {
  const configured =
    process.env.CIRCLE_GATEWAY_URL?.trim() ??
    process.env.X402_FACILITATOR_URL?.trim();

  if (configured) {
    return configured.replace(/\/$/, "");
  }

  return isSigillumX402Testnet()
    ? DEFAULT_X402_TESTNET_FACILITATOR_URL
    : DEFAULT_X402_MAINNET_FACILITATOR_URL;
}

export function isSigillumX402Testnet(): boolean {
  const network = getSigillumX402Network();
  return network.toLowerCase().includes("testnet") || network.toLowerCase().includes("sepolia") || network.toLowerCase().includes("amoy") || network.toLowerCase().includes("fuji") || network.toLowerCase().includes("atlantic");
}

export function getCircleGatewayAuthHeaders(): Record<string, string> {
  const apiKey = process.env.CIRCLE_GATEWAY_API_KEY?.trim();

  if (!apiKey) {
    return {};
  }

  return {
    Authorization: `Bearer ${apiKey}`,
    "X-API-Key": apiKey,
  };
}

export function isSigillumX402Configured(): boolean {
  return Boolean(getSigillumX402SellerAddress());
}
