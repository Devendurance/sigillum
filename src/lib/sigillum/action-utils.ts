import { createHash } from "node:crypto";
import type {
  SigillumActionEnvelope,
  SigillumActionInputSummary,
  SigillumActionType,
} from "./lifecycle";
import type { InspectedUnits } from "./types";

export function createActionInputSummary(envelope: SigillumActionEnvelope): SigillumActionInputSummary {
  switch (envelope.action_type) {
    case "dependency_install":
      return {
        kind: "dependency_install",
        package_name: envelope.action_input.package_name,
        ...(envelope.action_input.version_spec ? { version_spec: envelope.action_input.version_spec } : {}),
        ...(envelope.action_input.package_manager ? { package_manager: envelope.action_input.package_manager } : {}),
        ...(envelope.action_input.manifest_path ? { manifest_path: envelope.action_input.manifest_path } : {}),
        ...(envelope.action_input.reason ? { reason: envelope.action_input.reason } : {}),
      };
    case "deploy_action":
      return {
        kind: "deploy_action",
        service: envelope.action_input.service,
        target_environment: envelope.action_input.target_environment,
        ...(envelope.action_input.artifact_ref ? { artifact_ref: envelope.action_input.artifact_ref } : {}),
        ...(envelope.action_input.commit_sha ? { commit_sha: envelope.action_input.commit_sha } : {}),
        ...(envelope.action_input.change_summary ? { change_summary: envelope.action_input.change_summary } : {}),
      };
    case "code_change":
    default:
      return {
        kind: "code_change",
        ...(envelope.action_input.repo ? { repo: envelope.action_input.repo } : {}),
        ...(envelope.action_input.branch ? { branch: envelope.action_input.branch } : {}),
        ...(envelope.action_input.commit_sha ? { commit_sha: envelope.action_input.commit_sha } : {}),
      };
  }
}

export function createActionSourceHash(envelope: SigillumActionEnvelope) {
  return createHash("sha256").update(canonicalizeActionEnvelope(envelope)).digest("hex");
}

export function canonicalizeActionEnvelope(envelope: SigillumActionEnvelope) {
  return JSON.stringify({
    action_type: envelope.action_type,
    action_input: normalizeActionInputForHash(envelope),
  });
}

export function createSafeActionSummary({
  actionType,
  actionInputSummary,
  inspectedUnits,
  findingsCategories,
  sourceHash,
}: {
  actionType: SigillumActionType;
  actionInputSummary: SigillumActionInputSummary | null;
  inspectedUnits: InspectedUnits | null;
  findingsCategories: string[];
  sourceHash: string | null;
}) {
  const categorySummary =
    findingsCategories.length > 0 ? findingsCategories.join(", ") : "no finding categories recorded";
  const hashSummary = sourceHash ? ` hash ${sourceHash.slice(0, 12)}` : "";

  switch (actionType) {
    case "dependency_install": {
      const packageName =
        actionInputSummary?.kind === "dependency_install" ? actionInputSummary.package_name : "unknown package";
      const versionSpec =
        actionInputSummary?.kind === "dependency_install" && actionInputSummary.version_spec
          ? `@${actionInputSummary.version_spec}`
          : "";
      const packageManager =
        actionInputSummary?.kind === "dependency_install" && actionInputSummary.package_manager
          ? ` via ${actionInputSummary.package_manager}`
          : "";
      return `dependency install inspected for ${packageName}${versionSpec}${packageManager}, ${categorySummary},${hashSummary}`.replace(
        /,\s*$/,
        "",
      );
    }
    case "deploy_action": {
      const service = actionInputSummary?.kind === "deploy_action" ? actionInputSummary.service : "unknown service";
      const environment =
        actionInputSummary?.kind === "deploy_action"
          ? actionInputSummary.target_environment
          : "unknown environment";
      return `deploy action inspected for ${service} to ${environment}, ${categorySummary},${hashSummary}`.replace(
        /,\s*$/,
        "",
      );
    }
    case "code_change":
    default: {
      const changedLines = inspectedUnits?.changed_lines ?? 0;
      return `code change inspected with ${changedLines} changed lines, ${categorySummary},${hashSummary}`.replace(
        /,\s*$/,
        "",
      );
    }
  }
}

function normalizeActionInputForHash(envelope: SigillumActionEnvelope) {
  switch (envelope.action_type) {
    case "dependency_install":
      return {
        package_name: envelope.action_input.package_name,
        version_spec: envelope.action_input.version_spec ?? null,
        package_manager: envelope.action_input.package_manager ?? null,
        manifest_path: envelope.action_input.manifest_path ?? null,
        install_command: envelope.action_input.install_command ?? null,
        reason: envelope.action_input.reason ?? null,
      };
    case "deploy_action":
      return {
        service: envelope.action_input.service,
        target_environment: envelope.action_input.target_environment,
        artifact_ref: envelope.action_input.artifact_ref ?? null,
        commit_sha: envelope.action_input.commit_sha ?? null,
        deploy_command: envelope.action_input.deploy_command ?? null,
        change_summary: envelope.action_input.change_summary ?? null,
      };
    case "code_change":
    default:
      return {
        diff: envelope.action_input.diff,
        repo: envelope.action_input.repo ?? null,
        branch: envelope.action_input.branch ?? null,
        commit_sha: envelope.action_input.commit_sha ?? null,
      };
  }
}
