import type { SigillumActionStage, SigillumActionType } from "./lifecycle";

import type {
  PaymentRail,
  PaymentRequirement,
  SigillumSettlementScope,
  SigillumSettlementSource,
  SigillumSettlementStatus,
  SigillumPaymentMode,
} from "./payment/types";

export type SigillumSeverity = "info" | "low" | "medium" | "high" | "critical";

export type SigillumRecommendation = "pass" | "warn" | "block";

export type SigillumActionStatus =
  | "quoted"
  | "payment_required"
  | "inspected";

export type SigillumLifecycleEventType =
  | "quote.created"
  | "inspect.payment_required"
  | "inspect.completed";

export type AgentDecision = {
  agent_decision: "continue_merge" | "request_patch" | "stop_merge";
  reason: string;
  next_action: string;
  policy_matched: string;
};

export type Finding = {
  severity: SigillumSeverity;
  category: string;
  message: string;
  file?: string;
  line?: number;
};

export type InspectedUnits = {
  changed_lines: number;
  ast_nodes: number;
  dependency_changes: number;
  config_mutations: number;
  strings: number;
};

export type Quote = {
  quote_id: string;
  action_id?: string;
  currency: "USDC";
  amount: string;
  inspected_units: InspectedUnits;
  expires_at: string;
};

export type QuoteResponse = Quote & {
  action_id: string;
  current_stage?: SigillumActionStage;
};

export type SigillumReceipt = {
  receipt_id: string;
  seal: "Verified by Sigillum";
  score: number;
  recommendation: SigillumRecommendation;
  paid_amount_usdc: string;
  inspected_units: InspectedUnits;
  findings: Finding[];
  patch_recommendation: string;
  timestamp: string;
};

export type SigillumPublicReceipt = {
  receipt_id: string;
  action_id: string;
  agent_name: string;
  action_type: SigillumActionType;
  risk_score: number;
  recommendation: SigillumRecommendation;
  paid_amount_usdc: string;
  rail: PaymentRail | null;
  network: string | null;
  transaction_hash: string | null;
  payment_reference: string | null;
  settlement_status: SigillumSettlementStatus | null;
  settlement_scope: SigillumSettlementScope | null;
  settlement_source: SigillumSettlementSource | null;
  transaction_confirmed_at: string | null;
  batch_reference: string | null;
  receipt_hash: string;
  inspected_units: InspectedUnits;
  findings: Finding[];
  patch_recommendation: string;
  agent_decision: AgentDecision;
  timestamp: string;
  seal: "Verified by Sigillum";
};

export type SigillumPolicy = {
  block_on: readonly ("critical" | "secret_exposure" | "unsafe_dependency")[];
  warn_on: readonly ("copy_issue" | "minor_config_change" | "prompt_injection_surface")[];
  pass_below_score: number;
};

export type SigillumPaymentSummary = {
  mode: SigillumPaymentMode;
  rail: PaymentRail;
  payment_reference?: string;
  transaction_hash?: string;
  settlement_status?: SigillumSettlementStatus | null;
  settlement_scope?: SigillumSettlementScope | null;
  settlement_source?: SigillumSettlementSource | null;
  transaction_confirmed_at?: string | null;
  batch_reference?: string | null;
};

export type SigillumQuoteLifecyclePayload = {
  diff_sha256: string;
  demo_fallback_used: boolean;
  quote: Quote;
};

export type SigillumInspectPaymentRequiredPayload = {
  diff_sha256: string;
  payment: PaymentRequirement;
  quote: Quote;
  reason: string;
};

export type SigillumInspectCompletedPayload = {
  agent_decision: AgentDecision;
  diff_sha256: string;
  payment: SigillumPaymentSummary;
  quote: Quote;
  receipt: SigillumReceipt;
};

export type SigillumLifecyclePayload =
  | SigillumQuoteLifecyclePayload
  | SigillumInspectPaymentRequiredPayload
  | SigillumInspectCompletedPayload;

export type SigillumLifecycleEventEnvelope = {
  event_id: string;
  action_id: string;
  action_type: SigillumActionType;
  event_type: SigillumLifecycleEventType;
  quote_id: string;
  receipt_id?: string;
  occurred_at: string;
  payload: SigillumLifecyclePayload;
};

export type SigillumActionEnvelope = {
  action_id: string;
  action_type: SigillumActionType;
  status: SigillumActionStatus;
  diff_sha256: string;
  quote: Quote;
  payment?: SigillumPaymentSummary;
  receipt?: SigillumReceipt;
  agent_decision?: AgentDecision;
  lifecycle: SigillumLifecycleEventEnvelope[];
  created_at: string;
  updated_at: string;
  latest_event_at: string;
};

export type SigillumLiveActionRow = {
  action_id: string;
  agent_id: string | null;
  agent_name: string;
  action_type: SigillumActionType;
  current_stage: SigillumActionStage;
  amount: string | null;
  rail: PaymentRail | null;
  network: string | null;
  transaction_hash: string | null;
  payment_reference: string | null;
  settlement_status: SigillumSettlementStatus | null;
  settlement_scope: SigillumSettlementScope | null;
  settlement_source: SigillumSettlementSource | null;
  transaction_confirmed_at: string | null;
  batch_reference: string | null;
  risk_score: number | null;
  recommendation: SigillumRecommendation | null;
  receipt_id: string | null;
  agent_decision: AgentDecision["agent_decision"] | null;
  source_hash: string | null;
  inspected_units: InspectedUnits | null;
  findings_categories: string[];
  file_types: string[];
  safe_summary: string;
  timestamp: string;
  lifecycle_events: SigillumLiveActionLifecycleEvent[];
};

export type SigillumLiveActionLifecycleEvent = {
  stage: SigillumActionStage;
  timestamp: string;
  quote_id?: string;
  amount?: string;
  payment_reference?: string;
  transaction_hash?: string;
  settlement_status?: SigillumSettlementStatus;
  settlement_scope?: SigillumSettlementScope;
  settlement_source?: SigillumSettlementSource;
  transaction_confirmed_at?: string;
  batch_reference?: string;
  receipt_id?: string;
  decision?: AgentDecision["agent_decision"];
};
