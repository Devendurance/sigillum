import { createHash } from "node:crypto";
import { analyzeDiff } from "./analyzer";
import { calculateQuote } from "./quote";
import { recommendFromRiskScoreAndFindings } from "./policy";
import type { Finding, SigillumReceipt } from "./types";

export function generateSigillumReceipt(diff: string, paidAmountUsdc?: string): SigillumReceipt {
  const quote = calculateQuote(diff);
  const findings = analyzeDiff(diff);
  const score = riskScoreFromFindings(findings);
  const recommendation = recommendFromRiskScoreAndFindings(score, findings);

  return {
    receipt_id: stableId("sig", `${diff}::${quote.amount}`),
    seal: "Verified by Sigillum",
    score,
    recommendation,
    paid_amount_usdc: paidAmountUsdc ?? quote.amount,
    inspected_units: quote.inspected_units,
    findings,
    patch_recommendation: patchRecommendationForFindings(findings),
    timestamp: new Date().toISOString(),
  };
}

export function riskScoreFromFindings(findings: Finding[]): number {
  const penalties = findings.reduce((total, finding) => {
    switch (finding.severity) {
      case "critical":
        return total + 42;
      case "high":
        return total + 18;
      case "medium":
        return total + 8;
      case "low":
        return total + 3;
      case "info":
      default:
        return total + 1;
    }
  }, 0);

  return Math.min(100, penalties);
}

function patchRecommendationForFindings(findings: Finding[]): string {
  const secretExposure = findings.find((finding) => finding.category === "secret_exposure");
  if (secretExposure) {
    return "Remove the exposed secret, rotate the credential, and regenerate the patch.";
  }

  const unsafeDependency = findings.find((finding) => finding.category === "unsafe_dependency");
  if (unsafeDependency) {
    return "Replace the unsafe dependency with a vetted alternative and rerun inspection.";
  }

  const promptInjection = findings.find((finding) => finding.category === "prompt_injection_surface");
  if (promptInjection) {
    return "Strip the prompt-injection text and resubmit the diff.";
  }

  const copyIssue = findings.find((finding) => finding.category === "copy_issue");
  if (copyIssue) {
    return "Correct the user-facing typo or copy issue and rerun inspection.";
  }

  return "No patch required beyond preserving the current bounded diff surface.";
}

function stableId(prefix: string, value: string): string {
  return `${prefix}_${createHash("sha256").update(value).digest("hex").slice(0, 12)}`;
}
