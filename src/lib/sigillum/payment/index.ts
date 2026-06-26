import { createHash } from "node:crypto";
import { CHAIN_CONFIGS } from "@circle-fin/x402-batching/client";
import {
  BatchFacilitatorClient,
  GATEWAY_AUTH_VALIDITY_WINDOW_SECONDS,
} from "@circle-fin/x402-batching/server";
import {
  decodePaymentSignatureHeader,
  encodePaymentRequiredHeader,
  encodePaymentResponseHeader,
} from "@x402/core/http";
import type {
  PaymentPayload,
  PaymentRequired,
  PaymentRequirements,
} from "@x402/core/types";
import {
  getCircleGatewayAuthHeaders,
  getSigillumPaymentMode,
  getSigillumX402FacilitatorUrl,
  getSigillumX402Network,
  getSigillumX402ResourceNetwork,
  getSigillumX402SellerAddress,
  isSigillumX402Configured,
} from "./config";
import type {
  PaymentRequirement,
  PaymentVerificationResult,
  PaymentRail,
  SigillumPaymentMode,
  X402PaymentDetails,
} from "./types";

type CreatePaymentRequirementInput = {
  amount: string;
  quoteId?: string;
  expiresAt?: string;
  mode?: SigillumPaymentMode;
  rail?: PaymentRail;
};

type VerifySigillumPaymentInput = {
  amount: string;
  quoteId?: string;
  paymentConfirmed?: boolean;
  paymentProof?: string;
  paymentSignature?: string;
  expiresAt?: string;
  resourceUrl?: string;
};

type X402RequestContext = {
  paymentRequired: PaymentRequired;
  paymentRequiredHeader: string;
  paymentRequirements: PaymentRequirements;
  requirement: PaymentRequirement;
};

let facilitatorClient: BatchFacilitatorClient | null = null;

export function createPaymentRequirement({
  amount,
  quoteId,
  expiresAt,
  mode = getSigillumPaymentMode(),
  rail = mode === "demo" ? "local-demo" : "x402",
}: CreatePaymentRequirementInput): PaymentRequirement {
  return {
    status: "payment_required",
    status_code: 402,
    message: "HTTP 402 Payment Required",
    network: "Arc",
    rail,
    currency: "USDC",
    amount,
    ...(quoteId ? { quote_id: quoteId } : {}),
    ...(expiresAt ? { expires_at: expiresAt } : {}),
    mode,
  };
}

export async function verifySigillumPayment({
  amount,
  quoteId,
  paymentConfirmed,
  paymentProof,
  paymentSignature,
  expiresAt,
  resourceUrl = "/api/inspect",
}: VerifySigillumPaymentInput): Promise<PaymentVerificationResult> {
  const mode = getSigillumPaymentMode();
  const rail: PaymentRail = mode === "demo" ? "local-demo" : "x402";
  const requirement = createPaymentRequirement({ amount, quoteId, expiresAt, mode, rail });

  if (mode === "demo") {
    if (paymentConfirmed === true) {
      return {
        ok: true,
        rail,
        mode,
        payment_reference: createPaymentReference({ amount, quoteId, paymentProof }),
      };
    }

    return {
      ok: false,
      rail,
      mode,
      reason: "Local demo payment simulation requires payment confirmation.",
      requirement,
    };
  }

  if (!isSigillumX402Configured()) {
    return {
      ok: false,
      rail,
      mode,
      reason: "x402 mode is selected, but the seller configuration is incomplete.",
      requirement,
    };
  }

  const x402Request = buildX402RequestContext({
    amount,
    quoteId,
    expiresAt,
    resourceUrl,
    requirement,
  });

  if (!paymentSignature) {
    return {
      ok: false,
      rail,
      mode,
      reason: "A signed x402 payment is required before Sigillum can inspect this diff.",
      requirement: x402Request.requirement,
      response_headers: {
        "PAYMENT-REQUIRED": x402Request.paymentRequiredHeader,
      },
    };
  }

  let paymentPayload: PaymentPayload;

  try {
    paymentPayload = decodePaymentSignatureHeader(paymentSignature);
  } catch {
    return {
      ok: false,
      rail,
      mode,
      reason: "The PAYMENT-SIGNATURE header could not be decoded.",
      requirement: x402Request.requirement,
      response_headers: {
        "PAYMENT-REQUIRED": x402Request.paymentRequiredHeader,
      },
    };
  }

  if (!matchesAcceptedRequirements(paymentPayload, x402Request.paymentRequirements)) {
    return {
      ok: false,
      rail,
      mode,
      reason: "The supplied payment does not match Sigillum's advertised x402 requirement.",
      requirement: x402Request.requirement,
      response_headers: {
        "PAYMENT-REQUIRED": x402Request.paymentRequiredHeader,
      },
    };
  }

  try {
    const facilitator = getFacilitatorClient();
    const verifyResult = await facilitator.verify(
      paymentPayload as Parameters<BatchFacilitatorClient["verify"]>[0],
      x402Request.paymentRequirements as Parameters<BatchFacilitatorClient["verify"]>[1],
    );

    if (!verifyResult.isValid) {
      return {
        ok: false,
        rail,
        mode,
        reason:
          verifyResult.invalidReason ??
          "The x402 payment could not be verified.",
        requirement: x402Request.requirement,
        response_headers: {
          "PAYMENT-REQUIRED": x402Request.paymentRequiredHeader,
        },
      };
    }

    const settleResult = await facilitator.settle(
      paymentPayload as Parameters<BatchFacilitatorClient["settle"]>[0],
      x402Request.paymentRequirements as Parameters<BatchFacilitatorClient["settle"]>[1],
    );

    if (!settleResult.success) {
      return {
        ok: false,
        rail,
        mode,
        reason:
          settleResult.errorReason ??
          "The x402 payment was verified but facilitator settlement failed.",
        requirement: x402Request.requirement,
        response_headers: {
          "PAYMENT-REQUIRED": x402Request.paymentRequiredHeader,
        },
      };
    }

    return {
      ok: true,
      rail,
      mode,
      payment_reference: settleResult.transaction,
      response_headers: {
        "PAYMENT-RESPONSE": encodePaymentResponseHeader(
          settleResult as Parameters<typeof encodePaymentResponseHeader>[0],
        ),
      },
    };
  } catch (error) {
    return {
      ok: false,
      rail,
      mode,
      reason: getX402FailureReason(error),
      requirement: x402Request.requirement,
      response_headers: {
        "PAYMENT-REQUIRED": x402Request.paymentRequiredHeader,
      },
    };
  }
}

function buildX402RequestContext({
  amount,
  quoteId,
  expiresAt,
  resourceUrl,
  requirement,
}: {
  amount: string;
  quoteId?: string;
  expiresAt?: string;
  resourceUrl: string;
  requirement: PaymentRequirement;
}): X402RequestContext {
  const paymentRequirements = createX402PaymentRequirements(amount);
  const paymentRequired = createX402PaymentRequired(paymentRequirements, resourceUrl);
  const paymentRequiredHeader = encodePaymentRequiredHeader(paymentRequired);

  return {
    paymentRequired,
    paymentRequiredHeader,
    paymentRequirements,
    requirement: {
      ...requirement,
      network: formatPaymentNetwork(paymentRequirements.network),
      x402: buildX402PaymentDetails(paymentRequired, paymentRequiredHeader),
      ...(quoteId ? { quote_id: quoteId } : {}),
      ...(expiresAt ? { expires_at: expiresAt } : {}),
    },
  };
}

function createX402PaymentRequirements(amount: string): PaymentRequirements {
  const sellerAddress = getSigillumX402SellerAddress();

  if (!sellerAddress) {
    throw new Error("Missing X402_SELLER_ADDRESS.");
  }

  const chainConfig = CHAIN_CONFIGS[getSigillumX402Network()];

  return {
    scheme: "exact",
    network: getSigillumX402ResourceNetwork(),
    asset: chainConfig.usdc,
    amount: convertUsdcToAtomicUnits(amount),
    payTo: sellerAddress,
    maxTimeoutSeconds: GATEWAY_AUTH_VALIDITY_WINDOW_SECONDS,
    extra: {
      name: "GatewayWalletBatched",
      version: "1",
      verifyingContract: chainConfig.gatewayWallet,
    },
  };
}

function createX402PaymentRequired(
  paymentRequirements: PaymentRequirements,
  resourceUrl: string,
): PaymentRequired {
  return {
    x402Version: 2,
    error: "HTTP 402 Payment Required",
    resource: {
      url: resourceUrl,
      description: "Sigillum inspection unlock",
      mimeType: "application/json",
      serviceName: "Sigillum",
      tags: ["security", "code-review", "diff-inspection"],
    },
    accepts: [paymentRequirements],
  };
}

function buildX402PaymentDetails(
  paymentRequired: PaymentRequired,
  paymentRequiredHeader: string,
): X402PaymentDetails {
  return {
    x402_version: paymentRequired.x402Version,
    resource: {
      url: paymentRequired.resource.url,
      description: paymentRequired.resource.description,
      mime_type: paymentRequired.resource.mimeType,
    },
    accepts: paymentRequired.accepts.map((accept) => ({
      scheme: accept.scheme,
      network: accept.network,
      asset: accept.asset,
      atomic_amount: accept.amount,
      pay_to: accept.payTo,
      max_timeout_seconds: accept.maxTimeoutSeconds,
      ...(accept.extra && Object.keys(accept.extra).length > 0 ? { extra: accept.extra } : {}),
    })),
    payment_required_header: paymentRequiredHeader,
  };
}

function getFacilitatorClient(): BatchFacilitatorClient {
  facilitatorClient ??= new BatchFacilitatorClient({
    url: getSigillumX402FacilitatorUrl(),
    createAuthHeaders: async () => {
      const headers = getCircleGatewayAuthHeaders();
      return {
        verify: headers,
        settle: headers,
        supported: headers,
      };
    },
  });

  return facilitatorClient;
}

function matchesAcceptedRequirements(
  paymentPayload: PaymentPayload,
  paymentRequirements: PaymentRequirements,
): boolean {
  const accepted = paymentPayload.accepted;

  if (!accepted) {
    return false;
  }

  return (
    accepted.scheme === paymentRequirements.scheme &&
    accepted.network === paymentRequirements.network &&
    accepted.asset.toLowerCase() === paymentRequirements.asset.toLowerCase() &&
    accepted.amount === paymentRequirements.amount &&
    accepted.payTo.toLowerCase() === paymentRequirements.payTo.toLowerCase() &&
    accepted.maxTimeoutSeconds === paymentRequirements.maxTimeoutSeconds &&
    accepted.extra?.name === paymentRequirements.extra?.name &&
    accepted.extra?.version === paymentRequirements.extra?.version &&
    accepted.extra?.verifyingContract === paymentRequirements.extra?.verifyingContract
  );
}

function convertUsdcToAtomicUnits(amount: string): string {
  const normalized = amount.trim();

  if (!/^\d+(\.\d+)?$/.test(normalized)) {
    throw new Error(`Invalid USDC amount: ${amount}`);
  }

  const [wholePart, fractionalPart = ""] = normalized.split(".");
  const paddedFraction = `${fractionalPart}000000`.slice(0, 6);

  return `${BigInt(wholePart || "0") * BigInt(1_000_000) + BigInt(paddedFraction || "0")}`;
}

function createPaymentReference({
  amount,
  quoteId,
  paymentProof,
}: {
  amount: string;
  quoteId?: string;
  paymentProof?: string;
}): string {
  const digest = createHash("sha256")
    .update([amount, quoteId ?? "", paymentProof ?? "", "demo"].join(":"))
    .digest("hex")
    .slice(0, 16);

  return quoteId ? `demo_${quoteId}_${digest}` : `demo_${digest}`;
}

function formatPaymentNetwork(network?: string): string {
  switch (network) {
    case "eip155:5042":
      return "Arc Mainnet";
    case "eip155:5042002":
      return "Arc Testnet";
    default:
      return network ?? "Arc";
  }
}

function getX402FailureReason(error: unknown): string {
  if (typeof error === "object" && error !== null) {
    const candidate = error as {
      invalidMessage?: unknown;
      invalidReason?: unknown;
      errorMessage?: unknown;
      errorReason?: unknown;
      message?: unknown;
    };

    if (typeof candidate.invalidMessage === "string" && candidate.invalidMessage.length > 0) {
      return candidate.invalidMessage;
    }

    if (typeof candidate.errorMessage === "string" && candidate.errorMessage.length > 0) {
      return candidate.errorMessage;
    }

    if (typeof candidate.invalidReason === "string" && candidate.invalidReason.length > 0) {
      return candidate.invalidReason;
    }

    if (typeof candidate.errorReason === "string" && candidate.errorReason.length > 0) {
      return candidate.errorReason;
    }

    if (typeof candidate.message === "string" && candidate.message.length > 0) {
      return candidate.message;
    }
  }

  return "The x402 payment flow failed during verification or settlement.";
}
