export type SigillumPaymentMode = "demo" | "x402";

export type PaymentRail = "local-demo" | "x402";

export type SigillumSettlementStatus =
  | "gateway_received"
  | "batched"
  | "confirmed"
  | "completed"
  | "failed"
  | "unresolved";

export type SigillumSettlementScope = "individual" | "batch" | "unknown";

export type SigillumSettlementSource =
  | "gateway_api"
  | "gateway_transfer_payload"
  | "arc_log_resolution"
  | "manual_backfill";

export type X402AcceptedPayment = {
  scheme: string;
  network: string;
  asset: string;
  atomic_amount: string;
  pay_to: string;
  max_timeout_seconds: number;
  extra?: Record<string, unknown>;
};

export type X402PaymentDetails = {
  x402_version: number;
  resource: {
    url: string;
    description?: string;
    mime_type?: string;
  };
  accepts: X402AcceptedPayment[];
  payment_required_header?: string;
  payment_response_header?: string;
};

export type PaymentStatus =
  | "payment_required"
  | "payment_confirmed"
  | "payment_failed";

export type PaymentRequirement = {
  status: "payment_required";
  status_code: 402;
  message: "HTTP 402 Payment Required";
  network: string;
  rail: PaymentRail;
  currency: "USDC";
  amount: string;
  quote_id?: string;
  expires_at?: string;
  mode: SigillumPaymentMode;
  x402?: X402PaymentDetails;
};

export type SigillumPaymentHeaders = Partial<{
  "PAYMENT-REQUIRED": string;
  "PAYMENT-RESPONSE": string;
}>;

export type PaymentVerificationResult =
  | {
      ok: true;
      rail: PaymentRail;
      mode: SigillumPaymentMode;
      payment_reference: string;
      response_headers?: SigillumPaymentHeaders;
    }
  | {
      ok: false;
      rail: PaymentRail;
      mode: SigillumPaymentMode;
      reason: string;
      requirement: PaymentRequirement;
      response_headers?: SigillumPaymentHeaders;
    };

export type SigillumSettlementProof = {
  payment_reference: string;
  transaction_hash: string | null;
  settlement_status: SigillumSettlementStatus;
  settlement_scope: SigillumSettlementScope;
  settlement_source: SigillumSettlementSource | null;
  transaction_confirmed_at: string | null;
  batch_reference: string | null;
  gateway_transfer_json: Record<string, unknown> | null;
  settlement_last_checked_at: string;
};
