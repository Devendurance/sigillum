export type SigillumPaymentMode = "demo" | "x402";

export type PaymentRail = "local-demo" | "x402";

export type PaymentStatus =
  | "payment_required"
  | "payment_confirmed"
  | "payment_failed";

export type PaymentRequirement = {
  status: "payment_required";
  status_code: 402;
  message: "HTTP 402 Payment Required";
  network: "Arc";
  rail: PaymentRail;
  currency: "USDC";
  amount: string;
  quote_id?: string;
  expires_at?: string;
  mode: SigillumPaymentMode;
};

export type PaymentVerificationResult =
  | {
      ok: true;
      rail: PaymentRail;
      mode: SigillumPaymentMode;
      payment_reference: string;
    }
  | {
      ok: false;
      rail: PaymentRail;
      mode: SigillumPaymentMode;
      reason: string;
      requirement: PaymentRequirement;
    };

