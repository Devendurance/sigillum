import type {
  SigillumActionEnvelope,
  SigillumActionType,
  SigillumCodeChangeInput,
  SigillumDependencyInstallInput,
  SigillumDeployActionInput,
} from "./lifecycle";
import { getSigillumPaymentMode } from "./payment/config";
import { sampleRiskyDiff } from "./sample-diff";

type LegacyDiffBody = {
  diff?: string;
  idempotency_key?: string;
  agent?: {
    id?: string;
    name?: string;
    type?: string;
  };
  action_type?: string;
  action_input?: Record<string, unknown>;
};

export function normalizeActionEnvelope(
  body: LegacyDiffBody,
  {
    defaultAgentName = "Sigillum API",
    allowSampleFallback = isInternalFallbackAllowed(),
  }: {
    defaultAgentName?: string;
    allowSampleFallback?: boolean;
  } = {},
): SigillumActionEnvelope | null {
  const envelope = tryReadActionEnvelope(body, defaultAgentName, allowSampleFallback);
  if (!envelope) {
    return null;
  }

  if (!envelope.agent.name.trim()) {
    return null;
  }

  switch (envelope.action_type) {
    case "dependency_install":
      return envelope.action_input.package_name.trim() ? envelope : null;
    case "deploy_action":
      return envelope.action_input.service.trim() && envelope.action_input.target_environment.trim()
        ? envelope
        : null;
    case "code_change":
    default:
      return envelope.action_input.diff.trim() ? envelope : null;
  }
}

export function isInternalFallbackAllowed() {
  return getSigillumPaymentMode() !== "x402";
}

function tryReadActionEnvelope(
  body: LegacyDiffBody,
  defaultAgentName: string,
  allowSampleFallback: boolean,
): SigillumActionEnvelope | null {
  const actionType = normalizeActionType(body.action_type, body.action_input, body.diff);
  if (!actionType) {
    return null;
  }

  const agent = normalizeAgent(body.agent, defaultAgentName);
  const idempotencyKey =
    typeof body.idempotency_key === "string" && body.idempotency_key.trim()
      ? body.idempotency_key.trim()
      : undefined;

  switch (actionType) {
    case "dependency_install": {
      const actionInput = compactDependencyInstallInput(body.action_input ?? {});
      if (!actionInput.package_name) {
        return null;
      }

      return {
        agent,
        action_type: "dependency_install",
        action_input: actionInput,
        ...(idempotencyKey ? { idempotency_key: idempotencyKey } : {}),
      };
    }
    case "deploy_action": {
      const actionInput = compactDeployActionInput(body.action_input ?? {});
      if (!actionInput.service || !actionInput.target_environment) {
        return null;
      }

      return {
        agent,
        action_type: "deploy_action",
        action_input: actionInput,
        ...(idempotencyKey ? { idempotency_key: idempotencyKey } : {}),
      };
    }
    case "code_change":
    default: {
      const diff = normalizeDiff(body, allowSampleFallback);
      if (!diff) {
        return null;
      }

      const actionInput = body.action_input ?? {};
      return {
        agent,
        action_type: "code_change",
        action_input: compactCodeChangeInput({
          diff,
          repo: readString(actionInput.repo) ?? undefined,
          branch: readString(actionInput.branch) ?? undefined,
          commit_sha: readString(actionInput.commit_sha) ?? undefined,
        }),
        ...(idempotencyKey ? { idempotency_key: idempotencyKey } : {}),
      };
    }
  }
}

function normalizeDiff(body: LegacyDiffBody, allowSampleFallback: boolean) {
  const envelopeDiff = body.action_input?.diff;
  if (typeof envelopeDiff === "string" && envelopeDiff.trim().length > 0) {
    return envelopeDiff;
  }

  if (typeof body.diff === "string" && body.diff.trim().length > 0) {
    return body.diff;
  }

  if (allowSampleFallback) {
    return sampleRiskyDiff;
  }

  return null;
}

function compactCodeChangeInput(input: SigillumCodeChangeInput): SigillumCodeChangeInput {
  return {
    diff: input.diff,
    ...(typeof input.repo === "string" && input.repo.trim() ? { repo: input.repo.trim() } : {}),
    ...(typeof input.branch === "string" && input.branch.trim() ? { branch: input.branch.trim() } : {}),
    ...(typeof input.commit_sha === "string" && input.commit_sha.trim()
      ? { commit_sha: input.commit_sha.trim() }
      : {}),
  };
}

function compactDependencyInstallInput(input: Record<string, unknown>): SigillumDependencyInstallInput {
  return {
    package_name: readString(input.package_name) ?? "",
    ...(readString(input.version_spec) ? { version_spec: readString(input.version_spec)! } : {}),
    ...(readString(input.package_manager) ? { package_manager: readString(input.package_manager)! } : {}),
    ...(readString(input.manifest_path) ? { manifest_path: readString(input.manifest_path)! } : {}),
    ...(readString(input.install_command) ? { install_command: readString(input.install_command)! } : {}),
    ...(readString(input.reason) ? { reason: readString(input.reason)! } : {}),
  };
}

function compactDeployActionInput(input: Record<string, unknown>): SigillumDeployActionInput {
  return {
    service: readString(input.service) ?? "",
    target_environment: readString(input.target_environment) ?? "",
    ...(readString(input.artifact_ref) ? { artifact_ref: readString(input.artifact_ref)! } : {}),
    ...(readString(input.commit_sha) ? { commit_sha: readString(input.commit_sha)! } : {}),
    ...(readString(input.deploy_command) ? { deploy_command: readString(input.deploy_command)! } : {}),
    ...(readString(input.change_summary) ? { change_summary: readString(input.change_summary)! } : {}),
  };
}

function normalizeActionType(
  rawActionType: string | undefined,
  actionInput: Record<string, unknown> | undefined,
  legacyDiff: string | undefined,
): SigillumActionType | null {
  if (rawActionType === "code_change" || rawActionType === "dependency_install" || rawActionType === "deploy_action") {
    return rawActionType;
  }

  if (typeof legacyDiff === "string" && legacyDiff.trim()) {
    return "code_change";
  }

  if (typeof actionInput?.diff === "string" && actionInput.diff.trim()) {
    return "code_change";
  }

  return null;
}

function normalizeAgent(
  agent: LegacyDiffBody["agent"],
  defaultAgentName: string,
) {
  const safeAgent = agent ?? {};
  return {
    ...(typeof safeAgent.id === "string" && safeAgent.id.trim() ? { id: safeAgent.id.trim() } : {}),
    name:
      typeof safeAgent.name === "string" && safeAgent.name.trim().length > 0
        ? safeAgent.name.trim()
        : defaultAgentName,
    ...(typeof safeAgent.type === "string" && safeAgent.type.trim() ? { type: safeAgent.type.trim() } : {}),
  };
}

function readString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}
