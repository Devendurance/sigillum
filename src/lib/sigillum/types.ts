export type SigillumSeverity = "info" | "low" | "medium" | "high" | "critical";

export type SigillumRecommendation = "pass" | "warn" | "block";

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
  currency: "USDC";
  amount: string;
  inspected_units: InspectedUnits;
  expires_at: string;
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

export type SigillumPolicy = {
  block_on: readonly ("critical" | "secret_exposure" | "unsafe_dependency")[];
  warn_on: readonly ("copy_issue" | "minor_config_change" | "prompt_injection_surface")[];
  pass_below_score: number;
};
