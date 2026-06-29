import {
  buildCodeChangeEnvelope,
  buildDependencyInstallEnvelope,
  buildDeployActionEnvelope,
  createSigillumClient,
} from "@/lib/sigillum/cli-client";
import type { SigillumActionEnvelope, SigillumActionType } from "@/lib/sigillum/lifecycle";
import type { SigillumInspectResult } from "@/lib/sigillum/cli-client";
import { logSigillumInfo } from "./sigillum-log";

type AutomationAgentName = "CodeChangeAgent" | "DependencyInstallAgent" | "DeployActionAgent";

type AutomationAgentDefinition = {
  name: AutomationAgentName;
  actionType: SigillumActionType;
  enabled: boolean;
  intervalMs: number;
  dailyCapUsdc: string;
  buildEnvelope: () => SigillumActionEnvelope;
};

type AutomationAgentRunResult =
  | {
      agent: AutomationAgentName;
      action_type: SigillumActionType;
      status: "completed";
      action_id: string;
      quote_id: string;
      receipt_id: string;
      payment_reference?: string;
      transaction_hash?: string;
      recommendation: string;
      agent_decision: string;
    }
  | {
      agent: AutomationAgentName;
      action_type: SigillumActionType;
      status: "skipped";
      reason: string;
      action_id?: string;
      quote_id?: string;
    }
  | {
      agent: AutomationAgentName;
      action_type: SigillumActionType;
      status: "failed";
      reason: string;
      action_id?: string;
      quote_id?: string;
    };

type AutomationAgentCompletedResult = Extract<
  AutomationAgentRunResult,
  { status: "completed" }
>;

export async function runSigillumAutomationTick({
  baseUrl,
  requestTag,
}: {
  baseUrl: string;
  requestTag: string;
}) {
  const {
    findActionByPublicId,
    findCompletedOutcome,
    findLatestActionForAgent,
    getSettledAgentSpendSince,
  } = await import("./sigillum-store");

  const client = createSigillumClient({
    baseUrl,
    agentName: "Sigillum Automation",
  });

  const now = new Date();
  const startOfUtcDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const definitions = getAutomationAgentDefinitions();
  const results: AutomationAgentRunResult[] = [];

  for (const definition of definitions) {
    logSigillumInfo("automation.agent.evaluate", {
      request_tag: requestTag,
      agent: definition.name,
      action_type: definition.actionType,
    });

    if (!definition.enabled) {
      logSigillumInfo("automation.agent.skipped", {
        request_tag: requestTag,
        agent: definition.name,
        action_type: definition.actionType,
        reason: "automation_disabled",
      });
      results.push({
        agent: definition.name,
        action_type: definition.actionType,
        status: "skipped",
        reason: "automation_disabled",
      });
      continue;
    }

    const latestAction = await findLatestActionForAgent({
      agentName: definition.name,
      actionType: definition.actionType,
    });

    if (latestAction) {
      const elapsedMs = now.getTime() - latestAction.createdAt.getTime();
      if (elapsedMs < definition.intervalMs) {
        logSigillumInfo("automation.agent.skipped", {
          request_tag: requestTag,
          agent: definition.name,
          action_type: definition.actionType,
          reason: "interval_not_elapsed",
          action_id: latestAction.publicId,
          elapsed_ms: elapsedMs,
          interval_ms: definition.intervalMs,
        });
        results.push({
          agent: definition.name,
          action_type: definition.actionType,
          status: "skipped",
          reason: "interval_not_elapsed",
          action_id: latestAction.publicId,
        });
        continue;
      }
    }

    let quoteId: string | undefined;
    let actionPublicId: string | undefined;

    try {
      const envelope = definition.buildEnvelope();
      const quote = await client.quoteAction({
        ...envelope,
        idempotency_key: createAutomationIdempotencyKey({
          agentName: definition.name,
          actionType: definition.actionType,
          now,
        }),
      });

      quoteId = quote.quote_id;
      actionPublicId = quote.action_id;

      const action = await findActionByPublicId(quote.action_id);
      if (!action) {
        logSigillumInfo("automation.agent.skipped", {
          request_tag: requestTag,
          agent: definition.name,
          action_type: definition.actionType,
          reason: "persisted_action_missing_after_quote",
          action_id: quote.action_id,
          quote_id: quote.quote_id,
        });
        results.push({
          agent: definition.name,
          action_type: definition.actionType,
          status: "skipped",
          reason: "persisted_action_missing_after_quote",
          action_id: quote.action_id,
          quote_id: quote.quote_id,
        });
        continue;
      }

      const completedOutcome = await findCompletedOutcome(action.id);
      if (completedOutcome) {
        logSigillumInfo("automation.agent.skipped", {
          request_tag: requestTag,
          agent: definition.name,
          action_type: definition.actionType,
          reason: "existing_completed_outcome",
          action_id: quote.action_id,
          quote_id: quote.quote_id,
        });
        results.push({
          agent: definition.name,
          action_type: definition.actionType,
          status: "skipped",
          reason: "existing_completed_outcome",
          action_id: quote.action_id,
          quote_id: quote.quote_id,
        });
        continue;
      }

      const settledSpend = await getSettledAgentSpendSince({
        agentName: definition.name,
        startedAt: startOfUtcDay,
      });

      if (wouldExceedDailyCap({
        settledSpendUsdc: settledSpend,
        nextQuoteAmountUsdc: quote.amount,
        dailyCapUsdc: definition.dailyCapUsdc,
      })) {
        logSigillumInfo("automation.agent.skipped", {
          request_tag: requestTag,
          agent: definition.name,
          action_type: definition.actionType,
          reason: "daily_cap_exceeded",
          action_id: quote.action_id,
          quote_id: quote.quote_id,
          settled_spend_usdc: settledSpend,
          next_quote_amount_usdc: quote.amount,
          daily_cap_usdc: definition.dailyCapUsdc,
        });
        results.push({
          agent: definition.name,
          action_type: definition.actionType,
          status: "skipped",
          reason: "daily_cap_exceeded",
          action_id: quote.action_id,
          quote_id: quote.quote_id,
        });
        continue;
      }

      logSigillumInfo("automation.agent.running", {
        request_tag: requestTag,
        agent: definition.name,
        action_type: definition.actionType,
        action_id: quote.action_id,
        quote_id: quote.quote_id,
        amount: quote.amount,
      });

      const result = await client.inspectQuotedAction({
        envelope: {
          ...envelope,
          idempotency_key: envelope.idempotency_key ?? createAutomationIdempotencyKey({
            agentName: definition.name,
            actionType: definition.actionType,
            now,
          }),
        },
        quote,
      });

      const mappedResult = mapInspectResult(definition.name, definition.actionType, result);
      logSigillumInfo("automation.agent.completed", {
        request_tag: requestTag,
        agent: definition.name,
        action_type: definition.actionType,
        action_id: mappedResult.action_id,
        quote_id: mappedResult.quote_id,
        receipt_id: mappedResult.receipt_id,
        payment_reference: mappedResult.payment_reference,
        transaction_hash: mappedResult.transaction_hash,
        recommendation: mappedResult.recommendation,
        agent_decision: mappedResult.agent_decision,
      });
      results.push(mappedResult);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      logSigillumInfo("automation.agent.failed", {
        request_tag: requestTag,
        agent: definition.name,
        action_type: definition.actionType,
        action_id: actionPublicId,
        quote_id: quoteId,
        reason,
      });
      results.push({
        agent: definition.name,
        action_type: definition.actionType,
        status: "failed",
        reason,
        action_id: actionPublicId,
        quote_id: quoteId,
      });
    }
  }

  logSigillumInfo("automation.tick.completed", {
    request_tag: requestTag,
    completed: results.filter((entry) => entry.status === "completed").length,
    skipped: results.filter((entry) => entry.status === "skipped").length,
    failed: results.filter((entry) => entry.status === "failed").length,
  });

  return {
    ok: true,
    ran_at: now.toISOString(),
    results,
  };
}

export function isSigillumAutomationEnabled() {
  return readBooleanEnv("SIGILLUM_AUTOMATION_ENABLED", false);
}

export function isValidAutomationAuthorization(authorizationHeader: string | null) {
  const cronSecret = process.env.CRON_SECRET?.trim();
  const automationSecret = process.env.SIGILLUM_AUTOMATION_SHARED_SECRET?.trim();
  const provided = authorizationHeader?.trim();

  if (cronSecret && provided === `Bearer ${cronSecret}`) {
    return true;
  }

  if (automationSecret && provided === `Bearer ${automationSecret}`) {
    return true;
  }

  return false;
}

function getAutomationAgentDefinitions(): AutomationAgentDefinition[] {
  return [
    {
      name: "CodeChangeAgent",
      actionType: "code_change",
      enabled: readBooleanEnv("SIGILLUM_AUTOMATION_ENABLE_CODE_CHANGE_AGENT", true),
      intervalMs: readNumberEnv("SIGILLUM_AUTOMATION_CODE_CHANGE_INTERVAL_MS", readNumberEnv("SIGILLUM_AUTOMATION_DEFAULT_INTERVAL_MS", 30 * 60 * 1000)),
      dailyCapUsdc: readStringEnv("SIGILLUM_AUTOMATION_CODE_CHANGE_DAILY_CAP_USDC", readStringEnv("SIGILLUM_AUTOMATION_DAILY_CAP_USDC", "0.001000")),
      buildEnvelope: () =>
        buildCodeChangeEnvelope(
          process.env.SIGILLUM_AUTOMATION_CODE_CHANGE_DIFF?.trim() ||
            `diff --git a/src/runtime.ts b/src/runtime.ts
index 11aa22b..44bb55c 100644
--- a/src/runtime.ts
+++ b/src/runtime.ts
@@ -3,6 +3,7 @@
 export async function execute(userSuppliedScript: string) {
++  eval(userSuppliedScript)
   return "ok"
 }`,
          "CodeChangeAgent",
          {
            repo: process.env.SIGILLUM_AUTOMATION_CODE_CHANGE_REPO?.trim(),
            branch: process.env.SIGILLUM_AUTOMATION_CODE_CHANGE_BRANCH?.trim(),
            commitSha: process.env.SIGILLUM_AUTOMATION_CODE_CHANGE_COMMIT_SHA?.trim(),
          },
        ),
    },
    {
      name: "DependencyInstallAgent",
      actionType: "dependency_install",
      enabled: readBooleanEnv("SIGILLUM_AUTOMATION_ENABLE_DEPENDENCY_INSTALL_AGENT", false),
      intervalMs: readNumberEnv("SIGILLUM_AUTOMATION_DEPENDENCY_INSTALL_INTERVAL_MS", readNumberEnv("SIGILLUM_AUTOMATION_DEFAULT_INTERVAL_MS", 30 * 60 * 1000)),
      dailyCapUsdc: readStringEnv("SIGILLUM_AUTOMATION_DEPENDENCY_INSTALL_DAILY_CAP_USDC", readStringEnv("SIGILLUM_AUTOMATION_DAILY_CAP_USDC", "0.001000")),
      buildEnvelope: () =>
        buildDependencyInstallEnvelope(
          {
            package_name: process.env.SIGILLUM_AUTOMATION_DEPENDENCY_PACKAGE_NAME?.trim() || "postinstall-proxy",
            version_spec:
              process.env.SIGILLUM_AUTOMATION_DEPENDENCY_VERSION_SPEC?.trim() ||
              "git+https://github.com/example/postinstall-proxy.git",
            package_manager: process.env.SIGILLUM_AUTOMATION_DEPENDENCY_PACKAGE_MANAGER?.trim() || "npm",
            manifest_path: process.env.SIGILLUM_AUTOMATION_DEPENDENCY_MANIFEST_PATH?.trim() || "package.json",
            install_command:
              process.env.SIGILLUM_AUTOMATION_DEPENDENCY_INSTALL_COMMAND?.trim() ||
              "npm install postinstall-proxy",
            reason:
              process.env.SIGILLUM_AUTOMATION_DEPENDENCY_REASON?.trim() ||
              "Automated agent wants to add a package before continuing with a fix.",
          },
          "DependencyInstallAgent",
        ),
    },
    {
      name: "DeployActionAgent",
      actionType: "deploy_action",
      enabled: readBooleanEnv("SIGILLUM_AUTOMATION_ENABLE_DEPLOY_ACTION_AGENT", false),
      intervalMs: readNumberEnv("SIGILLUM_AUTOMATION_DEPLOY_ACTION_INTERVAL_MS", readNumberEnv("SIGILLUM_AUTOMATION_DEFAULT_INTERVAL_MS", 30 * 60 * 1000)),
      dailyCapUsdc: readStringEnv("SIGILLUM_AUTOMATION_DEPLOY_ACTION_DAILY_CAP_USDC", readStringEnv("SIGILLUM_AUTOMATION_DAILY_CAP_USDC", "0.001000")),
      buildEnvelope: () =>
        buildDeployActionEnvelope(
          {
            service: process.env.SIGILLUM_AUTOMATION_DEPLOY_SERVICE?.trim() || "payments-api",
            target_environment: process.env.SIGILLUM_AUTOMATION_DEPLOY_TARGET_ENVIRONMENT?.trim() || "production",
            artifact_ref:
              process.env.SIGILLUM_AUTOMATION_DEPLOY_ARTIFACT_REF?.trim() ||
              "ghcr.io/sigillum/payments-api:sha-abc1234",
            commit_sha:
              process.env.SIGILLUM_AUTOMATION_DEPLOY_COMMIT_SHA?.trim() || "abc1234def5678",
            deploy_command:
              process.env.SIGILLUM_AUTOMATION_DEPLOY_COMMAND?.trim() ||
              "kubectl apply -f deploy.yaml --force",
            change_summary:
              process.env.SIGILLUM_AUTOMATION_DEPLOY_CHANGE_SUMMARY?.trim() ||
              "Automated agent wants to roll out a production deploy after passing checks.",
          },
          "DeployActionAgent",
        ),
    },
  ];
}

function mapInspectResult(
  agentName: AutomationAgentName,
  actionType: SigillumActionType,
  result: SigillumInspectResult,
): AutomationAgentCompletedResult {
  return {
    agent: agentName,
    action_type: actionType,
    status: "completed",
    action_id: result.quote.action_id,
    quote_id: result.quote.quote_id,
    receipt_id: result.receipt.receipt_id,
    payment_reference: result.payment.payment_reference,
    transaction_hash: result.payment.transaction_hash,
    recommendation: result.receipt.recommendation,
    agent_decision: result.agent_decision.agent_decision,
  };
}

function createAutomationIdempotencyKey({
  agentName,
  actionType,
  now,
}: {
  agentName: AutomationAgentName;
  actionType: SigillumActionType;
  now: Date;
}) {
  const tick = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-${String(now.getUTCDate()).padStart(2, "0")}T${String(now.getUTCHours()).padStart(2, "0")}:${String(now.getUTCMinutes()).padStart(2, "0")}`;
  return `automation:${agentName}:${actionType}:${tick}`;
}

function wouldExceedDailyCap({
  settledSpendUsdc,
  nextQuoteAmountUsdc,
  dailyCapUsdc,
}: {
  settledSpendUsdc: string;
  nextQuoteAmountUsdc: string;
  dailyCapUsdc: string;
}) {
  return toMicroUsdc(settledSpendUsdc) + toMicroUsdc(nextQuoteAmountUsdc) > toMicroUsdc(dailyCapUsdc);
}

function toMicroUsdc(amount: string) {
  const [wholePart, fractionPart = ""] = amount.trim().split(".");
  const padded = `${fractionPart}000000`.slice(0, 6);
  return BigInt(wholePart || "0") * BigInt(1_000_000) + BigInt(padded || "0");
}

function readBooleanEnv(name: string, fallback: boolean) {
  const value = process.env[name]?.trim().toLowerCase();
  if (value === "true") {
    return true;
  }
  if (value === "false") {
    return false;
  }
  return fallback;
}

function readNumberEnv(name: string, fallback: number) {
  const value = process.env[name]?.trim();
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function readStringEnv(name: string, fallback: string) {
  const value = process.env[name]?.trim();
  return value && value.length > 0 ? value : fallback;
}
