import { createHash } from "node:crypto";
import { canonicalizeActionEnvelope } from "./action-utils";
import type {
  SigillumActionEnvelope,
  SigillumDependencyInstallInput,
  SigillumDeployActionInput,
} from "./lifecycle";
import type { InspectedUnits, Quote } from "./types";

const QUOTE_FLOOR_MICRO_USDC = 43;
const QUOTE_TTL_MINUTES = 10;

export function estimateInspectionUnits(diff: string): InspectedUnits {
  const lines = diff.split(/\r?\n/);

  let changedLines = 0;
  let astNodes = 0;
  let dependencyChanges = 0;
  let configMutations = 0;
  let strings = 0;

  const touchedConfigFiles = new Set<string>();
  const touchedDependencies = new Set<string>();

  let currentFile = "";
  let currentFileIsPackageJson = false;
  let currentFileIsCode = false;
  let currentFileIsConfig = false;

  for (const line of lines) {
    const header = line.match(/^diff --git a\/(.+?) b\/(.+)$/);
    if (header) {
      currentFile = header[2];
      currentFileIsPackageJson = currentFile === "package.json";
      currentFileIsCode = /\.[cm]?[jt]sx?$/.test(currentFile);
      currentFileIsConfig = /(^|\/)(next\.config\.[cm]?[jt]s|.*\.config\.[cm]?[jt]s|.*\.ya?ml|.*\.toml|\.env(?:\..*)?)$/i.test(
        currentFile,
      );
      continue;
    }

    const hunk = line.match(/^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
    if (hunk) {
      continue;
    }

    if (!/^[+-](?![+-])/.test(line)) {
      continue;
    }

    const content = line.slice(1);
    changedLines += 1;

    strings += countMatches(
      content,
      /(?:`(?:[^`\\]|\\.)*`|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/g,
    );

    if (currentFileIsPackageJson) {
      const depMatch = content.match(/^\s*"([^"]+)"\s*:\s*"[^"]*"\s*,?$/);
      const dependencyKey = depMatch?.[1];
      if (
        dependencyKey &&
        !isPackageJsonMetadataKey(dependencyKey) &&
        !touchedDependencies.has(dependencyKey)
      ) {
        touchedDependencies.add(dependencyKey);
        dependencyChanges += 1;
      }
    }

    if (currentFileIsConfig) {
      touchedConfigFiles.add(currentFile);
    }

    if (currentFileIsCode || looksSyntaxLike(content)) {
      const tokenCount = countMatches(
        content,
        /[A-Za-z_$][A-Za-z0-9_$]*|=>|===|!==|==|!=|&&|\|\||[{}()[\].,:;+*/<>-]/g,
      );
      astNodes += Math.max(1, Math.ceil(tokenCount / 6));
    }
  }

  configMutations = touchedConfigFiles.size;

  return {
    changed_lines: changedLines,
    ast_nodes: astNodes,
    dependency_changes: dependencyChanges,
    config_mutations: configMutations,
    strings,
  };
}

export function calculateQuote(diff: string): Quote {
  return calculateQuoteForAction({
    agent: {
      name: "Sigillum Quote",
    },
    action_type: "code_change",
    action_input: {
      diff,
    },
  });
}

export function calculateQuoteForAction(envelope: SigillumActionEnvelope): Quote {
  const inspectedUnits = estimateInspectionUnitsForAction(envelope);
  const microUsdc = Math.max(
    QUOTE_FLOOR_MICRO_USDC,
    inspectedUnits.changed_lines +
      inspectedUnits.dependency_changes * 7 +
      inspectedUnits.config_mutations * 4 +
      Math.ceil(inspectedUnits.ast_nodes / 6) +
      Math.ceil(inspectedUnits.strings / 5),
  );

  return {
    quote_id: stableId("quo", canonicalizeActionEnvelope(envelope)),
    currency: "USDC",
    amount: formatUsdc(microUsdc),
    inspected_units: inspectedUnits,
    expires_at: new Date(Date.now() + QUOTE_TTL_MINUTES * 60 * 1000).toISOString(),
  };
}

export function estimateInspectionUnitsForAction(envelope: SigillumActionEnvelope): InspectedUnits {
  switch (envelope.action_type) {
    case "dependency_install":
      return estimateDependencyInstallUnits(envelope.action_input);
    case "deploy_action":
      return estimateDeployActionUnits(envelope.action_input);
    case "code_change":
    default:
      return estimateInspectionUnits(envelope.action_input.diff);
  }
}

function countMatches(input: string, expression: RegExp): number {
  return input.match(expression)?.length ?? 0;
}

function isPackageJsonMetadataKey(key: string): boolean {
  return new Set([
    "name",
    "version",
    "private",
    "description",
    "license",
    "type",
    "scripts",
    "dependencies",
    "devDependencies",
    "peerDependencies",
    "optionalDependencies",
    "engines",
    "packageManager",
  ]).has(key);
}

function looksSyntaxLike(content: string): boolean {
  return /[{}()[\]=;<>]|(?:import|export|const|let|var|function|return|class)\b/.test(content);
}

function estimateDependencyInstallUnits(actionInput: SigillumDependencyInstallInput): InspectedUnits {
  const stringFields = [
    actionInput.package_name,
    actionInput.version_spec,
    actionInput.package_manager,
    actionInput.manifest_path,
    actionInput.install_command,
    actionInput.reason,
  ].filter((value): value is string => typeof value === "string" && value.trim().length > 0);

  const astNodes = Math.max(
    1,
    Math.ceil(
      countTokens(stringFields.join(" ")) / 5,
    ),
  );

  return {
    changed_lines: 1,
    ast_nodes: astNodes,
    dependency_changes: 1,
    config_mutations: actionInput.manifest_path ? 1 : 0,
    strings: stringFields.length,
  };
}

function estimateDeployActionUnits(actionInput: SigillumDeployActionInput): InspectedUnits {
  const stringFields = [
    actionInput.service,
    actionInput.target_environment,
    actionInput.artifact_ref,
    actionInput.commit_sha,
    actionInput.deploy_command,
    actionInput.change_summary,
  ].filter((value): value is string => typeof value === "string" && value.trim().length > 0);

  const astNodes = Math.max(1, Math.ceil(countTokens(stringFields.join(" ")) / 6));

  return {
    changed_lines: 0,
    ast_nodes: astNodes,
    dependency_changes: 0,
    config_mutations: 1,
    strings: stringFields.length,
  };
}

function countTokens(input: string) {
  return input.match(/[A-Za-z0-9._/@:-]+/g)?.length ?? 0;
}

function formatUsdc(microUsdc: number): string {
  return (microUsdc / 1_000_000).toFixed(6);
}

function stableId(prefix: string, value: string): string {
  return `${prefix}_${createHash("sha256").update(value).digest("hex").slice(0, 12)}`;
}
