import type { SigillumActionEnvelope, SigillumCodeChangeInput } from "./lifecycle";
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
  action_input?: {
    diff?: string;
    repo?: string;
    branch?: string;
    commit_sha?: string;
  };
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

  if (envelope.action_type !== "code_change") {
    return null;
  }

  if (!envelope.agent.name.trim()) {
    return null;
  }

  if (!envelope.action_input.diff.trim()) {
    return null;
  }

  return envelope;
}

export function isInternalFallbackAllowed() {
  return getSigillumPaymentMode() !== "x402";
}

function tryReadActionEnvelope(
  body: LegacyDiffBody,
  defaultAgentName: string,
  allowSampleFallback: boolean,
): SigillumActionEnvelope | null {
  const diff = normalizeDiff(body, allowSampleFallback);
  if (!diff) {
    return null;
  }

  const actionInput = body.action_input ?? {};
  const agent = body.agent ?? {};

  return {
    agent: {
      ...(typeof agent.id === "string" && agent.id.trim() ? { id: agent.id.trim() } : {}),
      name:
        typeof agent.name === "string" && agent.name.trim().length > 0
          ? agent.name.trim()
          : defaultAgentName,
      ...(typeof agent.type === "string" && agent.type.trim() ? { type: agent.type.trim() } : {}),
    },
    action_type: "code_change",
    action_input: compactCodeChangeInput({
      diff,
      repo: actionInput.repo,
      branch: actionInput.branch,
      commit_sha: actionInput.commit_sha,
    }),
    ...(typeof body.idempotency_key === "string" && body.idempotency_key.trim()
      ? { idempotency_key: body.idempotency_key.trim() }
      : {}),
  };
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
