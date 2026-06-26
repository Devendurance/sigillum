import type { AgentDecision, Finding, SigillumPolicy, SigillumRecommendation } from "./types";

export const SIGILLUM_POLICY: SigillumPolicy = {
  block_on: ["critical", "secret_exposure", "unsafe_dependency"],
  warn_on: ["copy_issue", "minor_config_change", "prompt_injection_surface"],
  pass_below_score: 40,
};

export function recommendFromRiskScoreAndFindings(
  score: number,
  findings: Finding[],
): SigillumRecommendation {
  if (
    findings.some(
      (finding) =>
        finding.severity === "critical" ||
        finding.category === "secret_exposure" ||
        finding.category === "unsafe_dependency",
    )
  ) {
    return "block";
  }

  if (score >= 70) {
    return "block";
  }

  if (
    findings.some(
      (finding) =>
        finding.category === "copy_issue" ||
        finding.category === "minor_config_change" ||
        finding.category === "prompt_injection_surface",
    ) ||
    score >= SIGILLUM_POLICY.pass_below_score
  ) {
    return "warn";
  }

  return "pass";
}

export function evaluateAgentDecision(score: number, findings: Finding[]): AgentDecision {
  const secretExposure = findings.find((finding) => finding.category === "secret_exposure");
  if (secretExposure) {
    return {
      agent_decision: "stop_merge",
      reason: "Critical secret exposure detected in the diff.",
      next_action: "remove_secret_and_regenerate_patch",
      policy_matched: "block_on.secret_exposure",
    };
  }

  const unsafeDependency = findings.find((finding) => finding.category === "unsafe_dependency");
  if (unsafeDependency) {
    return {
      agent_decision: "stop_merge",
      reason: "Unsafe dependency surface requires a hard stop before merge.",
      next_action: "replace_unsafe_dependency_and_regenerate_patch",
      policy_matched: "block_on.unsafe_dependency",
    };
  }

  const warningFinding = findings.find((finding) =>
    ["copy_issue", "minor_config_change", "prompt_injection_surface"].includes(finding.category),
  );
  if (score >= 70) {
    return {
      agent_decision: "stop_merge",
      reason: `Sigillum Risk Score ${score} indicates a high-risk change.`,
      next_action: "revise_patch_and_rerun_inspection",
      policy_matched: "risk_score_high",
    };
  }

  if (warningFinding || score >= SIGILLUM_POLICY.pass_below_score) {
    return {
      agent_decision: "request_patch",
      reason: warningFinding
        ? `Policy flagged ${warningFinding.category}.`
        : `Sigillum Risk Score ${score} requires a manual patch review.`,
      next_action: "revise_patch_and_rerun_inspection",
      policy_matched: warningFinding
        ? `warn_on.${warningFinding.category}`
        : "risk_score_warn_band",
    };
  }

  return {
    agent_decision: "continue_merge",
    reason: "No blocking policy matched and the Sigillum Risk Score remains low.",
    next_action: "continue_merge",
    policy_matched: "pass",
  };
}
