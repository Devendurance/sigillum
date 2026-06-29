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

export type SigillumActionType = "code_change" | "dependency_install" | "deploy_action";

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

export type SigillumDependencyInstallInput = {
  package_name: string;
  version_spec?: string;
  package_manager?: string;
  manifest_path?: string;
  install_command?: string;
  reason?: string;
};

export type SigillumDeployActionInput = {
  service: string;
  target_environment: string;
  artifact_ref?: string;
  commit_sha?: string;
  deploy_command?: string;
  change_summary?: string;
};

export type SigillumCodeChangeSummary = {
  kind: "code_change";
  repo?: string;
  branch?: string;
  commit_sha?: string;
};

export type SigillumDependencyInstallSummary = {
  kind: "dependency_install";
  package_name: string;
  version_spec?: string;
  package_manager?: string;
  manifest_path?: string;
  reason?: string;
};

export type SigillumDeployActionSummary = {
  kind: "deploy_action";
  service: string;
  target_environment: string;
  artifact_ref?: string;
  commit_sha?: string;
  change_summary?: string;
};

export type SigillumActionInputSummary =
  | SigillumCodeChangeSummary
  | SigillumDependencyInstallSummary
  | SigillumDeployActionSummary;

export type SigillumCodeChangeEnvelope = {
  agent: SigillumAgent;
  action_type: "code_change";
  action_input: SigillumCodeChangeInput;
  idempotency_key?: string;
};

export type SigillumDependencyInstallEnvelope = {
  agent: SigillumAgent;
  action_type: "dependency_install";
  action_input: SigillumDependencyInstallInput;
  idempotency_key?: string;
};

export type SigillumDeployActionEnvelope = {
  agent: SigillumAgent;
  action_type: "deploy_action";
  action_input: SigillumDeployActionInput;
  idempotency_key?: string;
};

export type SigillumActionEnvelope =
  | SigillumCodeChangeEnvelope
  | SigillumDependencyInstallEnvelope
  | SigillumDeployActionEnvelope;
