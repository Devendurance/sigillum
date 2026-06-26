import { createHash } from "node:crypto";
import { getSigillumPaymentMode, isSigillumX402Configured } from "./config";
import type {
  PaymentRequirement,
  PaymentVerificationResult,
  PaymentRail,
  SigillumPaymentMode,
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
  expiresAt?: string;
};

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
  expiresAt,
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
      reason: "x402 mode is selected, but payment verification is not configured yet.",
      requirement,
    };
  }

  // TODO: Integrate the official Circle / Arc / x402 verification flow here once the repo has the required SDKs and credentials.
  return {
    ok: false,
    rail,
    mode,
    reason: "x402 mode is configured, but real payment verification is not implemented yet.",
    requirement,
  };
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

