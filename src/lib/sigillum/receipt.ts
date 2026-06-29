import { createHash } from "node:crypto";
import { analyzeDiff, analyzeSigillumAction } from "./analyzer";
import type { SigillumActionEnvelope } from "./lifecycle";
import { calculateQuote, calculateQuoteForAction } from "./quote";
import { recommendFromRiskScoreAndFindings } from "./policy";
import type { Finding, SigillumReceipt } from "./types";

export function generateSigillumReceipt({
  diff,
  paidAmountUsdc,
  actionId,
  paymentReference,
}: {
  diff: string;
  paidAmountUsdc?: string;
  actionId?: string;
  paymentReference?: string;
}): SigillumReceipt {
  const quote = calculateQuote(diff);
  const findings = analyzeDiff(diff);
  const score = riskScoreFromFindings(findings);
  const recommendation = recommendFromRiskScoreAndFindings(score, findings);
  const timestamp = new Date().toISOString();

  return {
    receipt_id: stableId(
      "sig",
      `${actionId ?? "action"}::${paymentReference ?? "payment"}::${diff}::${quote.amount}::${timestamp}`,
    ),
    seal: "Verified by Sigillum",
    score,
    recommendation,
    paid_amount_usdc: paidAmountUsdc ?? quote.amount,
    inspected_units: quote.inspected_units,
    findings,
    patch_recommendation: patchRecommendationForFindings(findings),
    timestamp,
  };
}

export function generateSigillumReceiptForAction({
  envelope,
  paidAmountUsdc,
  actionId,
  paymentReference,
}: {
  envelope: SigillumActionEnvelope;
  paidAmountUsdc?: string;
  actionId?: string;
  paymentReference?: string;
}): SigillumReceipt {
  const quote = calculateQuoteForAction(envelope);
  const findings = analyzeSigillumAction(envelope);
  const score = riskScoreFromFindings(findings);
  const recommendation = recommendFromRiskScoreAndFindings(score, findings);
  const timestamp = new Date().toISOString();

  return {
    receipt_id: stableId(
      "sig",
      `${actionId ?? "action"}::${paymentReference ?? "payment"}::${JSON.stringify(envelope)}::${quote.amount}::${timestamp}`,
    ),
    seal: "Verified by Sigillum",
    score,
    recommendation,
    paid_amount_usdc: paidAmountUsdc ?? quote.amount,
    inspected_units: quote.inspected_units,
    findings,
    patch_recommendation: patchRecommendationForFindings(findings),
    timestamp,
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
