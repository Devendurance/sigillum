export const SIGILLUM_ACTION_STAGES = [
  "action_submitted",
  "quote_created",
  "payment_required",
  "payment_confirmed",
  "inspection_running",
  "receipt_generated",
  "agent_decision_created",
] as const;

export type SigillumActionStage = (typeof SIGILLUM_ACTION_STAGES)[number];

const stageOrder = new Map<SigillumActionStage, number>(
  SIGILLUM_ACTION_STAGES.map((stage, index) => [stage, index]),
);

export function compareSigillumActionStages(
  left: SigillumActionStage,
  right: SigillumActionStage,
) {
  return (stageOrder.get(left) ?? -1) - (stageOrder.get(right) ?? -1);
}

export function maxSigillumActionStage(
  left: SigillumActionStage,
  right: SigillumActionStage,
): SigillumActionStage {
  return compareSigillumActionStages(left, right) >= 0 ? left : right;
}

export type SigillumActionType = "code_change";

export type SigillumAgent = {
  id?: string;
  name: string;
  type?: string;
};

export type SigillumCodeChangeInput = {
  diff: string;
  repo?: string;
  branch?: string;
  commit_sha?: string;
};

export type SigillumActionEnvelope = {
  agent: SigillumAgent;
  action_type: "code_change";
  action_input: SigillumCodeChangeInput;
  idempotency_key?: string;
};
