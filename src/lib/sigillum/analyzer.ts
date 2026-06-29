import type { SigillumActionEnvelope } from "./lifecycle";
import type { Finding, SigillumSeverity } from "./types";
import { estimateInspectionUnits } from "./quote";

const DANGEROUS_API_PATTERNS = [
  {
    pattern: /\beval\s*\(/i,
    message: "Dynamic eval execution can run attacker-controlled code.",
  },
  {
    pattern: /\bnew Function\s*\(/i,
    message: "new Function creates an executable code path from strings.",
  },
  {
    pattern: /\bchild_process\b|\bexecFile\s*\(|\bspawn\s*\(|\bexec\s*\(/i,
    message: "Process execution primitives are exposed in the diff.",
  },
  {
    pattern: /\binnerHTML\b|\bdocument\.write\s*\(/i,
    message: "DOM sink usage can create script injection risk.",
  },
];

const PROMPT_INJECTION_PATTERNS = [
  /ignore previous instructions/i,
  /system:\s*/i,
  /assistant:\s*/i,
  /surface the build token/i,
  /write the contents of [`'"]?\.env\.example[`'"]?/i,
  /override the policy/i,
];

const COPY_TYPO_PATTERNS = [
  /\bsuccesful\b/i,
  /\breciept\b/i,
  /\bteh\b/i,
  /\bseperate\b/i,
  /\bconfigruation\b/i,
];

export function analyzeDiff(diff: string): Finding[] {
  const findings: Finding[] = [];
  const units = estimateInspectionUnits(diff);
  const lines = diff.split(/\r?\n/);

  let currentFile = "";
  let currentFileIsPackageJson = false;
  let currentFileIsConfig = false;
  let currentFileIsMarkdown = false;

  let oldLine = 0;
  let newLine = 0;

  for (const line of lines) {
    const header = line.match(/^diff --git a\/(.+?) b\/(.+)$/);
    if (header) {
      currentFile = header[2];
      currentFileIsPackageJson = currentFile === "package.json";
      currentFileIsConfig = /(^|\/)(next\.config\.[cm]?[jt]s|.*\.config\.[cm]?[jt]s|.*\.ya?ml|.*\.toml|\.env(?:\..*)?)$/i.test(
        currentFile,
      );
      currentFileIsMarkdown = /\.(md|mdx)$/i.test(currentFile);
      oldLine = 0;
      newLine = 0;
      continue;
    }

    const hunk = line.match(/^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
    if (hunk) {
      oldLine = Number.parseInt(hunk[1], 10);
      newLine = Number.parseInt(hunk[2], 10);
      continue;
    }

    if (!/^[+-](?![+-])/.test(line)) {
      if (oldLine > 0) {
        oldLine += 1;
      }
      if (newLine > 0) {
        newLine += 1;
      }
      continue;
    }

    const content = line.slice(1);
    const lineNumber = line.startsWith("+") ? newLine : oldLine;

    if (line.startsWith("+")) {
      maybeAddSecretFinding(findings, content, currentFile, lineNumber);
      maybeAddDependencyFinding(findings, content, currentFile, lineNumber, currentFileIsPackageJson);
      maybeAddConfigFinding(findings, content, currentFile, lineNumber, currentFileIsConfig);
      maybeAddDangerousApiFinding(findings, content, currentFile, lineNumber);
      maybeAddPromptInjectionFinding(findings, content, currentFile, lineNumber, currentFileIsMarkdown);
      maybeAddCopyFinding(findings, content, currentFile, lineNumber);
    }

    if (line.startsWith("-")) {
      maybeAddRemovedSecretContext(findings, content, currentFile, lineNumber);
    }

    if (line.startsWith("+")) {
      newLine += 1;
    } else {
      oldLine += 1;
    }
  }

  if (units.ast_nodes > 0 && units.changed_lines > 0) {
    findings.push({
      severity: "info",
      category: "syntax_structure_signal",
      message:
        "Mixed code, config, and markdown surfaces parsed cleanly enough to produce bounded inspection signals.",
    });
  }

  return sortFindings(findings);
}

export function analyzeSigillumAction(envelope: SigillumActionEnvelope): Finding[] {
  switch (envelope.action_type) {
    case "dependency_install":
      return analyzeDependencyInstall(envelope.action_input);
    case "deploy_action":
      return analyzeDeployAction(envelope.action_input);
    case "code_change":
    default:
      return analyzeDiff(envelope.action_input.diff);
  }
}

function maybeAddSecretFinding(
  findings: Finding[],
  content: string,
  file: string,
  lineNumber: number,
) {
  const envSecret = content.match(
    /\b(?:API_KEY|SECRET|TOKEN|PASSWORD|PRIVATE_KEY|ACCESS_KEY|SESSION_SECRET)\b\s*=\s*([^\s#]+)/i,
  );
  const secretLiteral = content.match(/sk_(?:live|test)_[A-Za-z0-9_-]{8,}|ghp_[A-Za-z0-9_-]{8,}|AIza[0-9A-Za-z_-]{8,}/);

  if (envSecret || secretLiteral) {
    findings.push({
      severity: "critical",
      category: "secret_exposure",
      message: "Potential secret value is present in a sample environment file.",
      file,
      line: lineNumber,
    });
  }
}

function maybeAddRemovedSecretContext(
  findings: Finding[],
  content: string,
  file: string,
  lineNumber: number,
) {
  if (
    /OPENAI_API_KEY|SESSION_SECRET|PRIVATE_KEY|PASSWORD|TOKEN/i.test(content) &&
    /replace|secret|live|sk_/i.test(content)
  ) {
    findings.push({
      severity: "critical",
      category: "secret_exposure",
      message: "Removed content still indicates a secret-bearing environment key.",
      file,
      line: lineNumber,
    });
  }
}

function maybeAddDependencyFinding(
  findings: Finding[],
  content: string,
  file: string,
  lineNumber: number,
  currentFileIsPackageJson: boolean,
) {
  if (!currentFileIsPackageJson) {
    return;
  }

  const dependency = content.match(/^\s*"([^"]+)"\s*:\s*"([^"]+)"/);
  const dependencyName = dependency?.[1];
  const dependencyVersion = dependency?.[2];

  if (!dependencyName || isPackageJsonMetadataKey(dependencyName)) {
    return;
  }

  if (
    /postinstall|guard|shell|remote|proxy|eval|hook|loader|patch/i.test(dependencyName) ||
    /git\+|https?:\/\/|file:|workspace:/i.test(dependencyVersion ?? "")
  ) {
    findings.push({
      severity: "high",
      category: "unsafe_dependency",
      message: `Dependency "${dependencyName}" introduces a potentially unsafe supply-chain surface.`,
      file,
      line: lineNumber,
    });
  } else {
    findings.push({
      severity: "medium",
      category: "dependency_risk",
      message: `Dependency "${dependencyName}" changes the package surface and should be reviewed.`,
      file,
      line: lineNumber,
    });
  }
}

function maybeAddConfigFinding(
  findings: Finding[],
  content: string,
  file: string,
  lineNumber: number,
  currentFileIsConfig: boolean,
) {
  if (!currentFileIsConfig) {
    return;
  }

  if (/dangerouslyAllowSVG\s*:\s*true/i.test(content) || /serverActions\s*:\s*true/i.test(content)) {
    findings.push({
      severity: "medium",
      category: "minor_config_change",
      message: "Runtime config was widened in a way that deserves a manual review.",
      file,
      line: lineNumber,
    });
    return;
  }

  if (/\b[A-Z0-9_]{4,}\s*=\s*[^\s#]+/.test(content)) {
    findings.push({
      severity: "high",
      category: "minor_config_change",
      message: "Environment-style config content changed and should be inspected for leakage.",
      file,
      line: lineNumber,
    });
    return;
  }

  findings.push({
    severity: "info",
    category: "minor_config_change",
    message: "Config surface changed without an obvious unsafe pattern.",
    file,
    line: lineNumber,
  });
}

function maybeAddDangerousApiFinding(
  findings: Finding[],
  content: string,
  file: string,
  lineNumber: number,
) {
  for (const entry of DANGEROUS_API_PATTERNS) {
    if (entry.pattern.test(content)) {
      findings.push({
        severity: "high",
        category: "dangerous_api",
        message: entry.message,
        file,
        line: lineNumber,
      });
      break;
    }
  }
}

function maybeAddPromptInjectionFinding(
  findings: Finding[],
  content: string,
  file: string,
  lineNumber: number,
  currentFileIsMarkdown: boolean,
) {
  if (!currentFileIsMarkdown && !/^(?:[>#!]|\/\/|#)/.test(content.trim())) {
    return;
  }

  if (PROMPT_INJECTION_PATTERNS.some((pattern) => pattern.test(content))) {
    findings.push({
      severity: "medium",
      category: "prompt_injection_surface",
      message: "The diff introduces text that looks like prompt-injection guidance.",
      file,
      line: lineNumber,
    });
  }
}

function maybeAddCopyFinding(
  findings: Finding[],
  content: string,
  file: string,
  lineNumber: number,
) {
  if (!COPY_TYPO_PATTERNS.some((pattern) => pattern.test(content))) {
    return;
  }

  findings.push({
    severity: "low",
    category: "copy_issue",
    message: "User-facing copy contains a typo or wording issue that should be cleaned up.",
    file,
    line: lineNumber,
  });
}

function analyzeDependencyInstall(actionInput: Extract<SigillumActionEnvelope, { action_type: "dependency_install" }>["action_input"]) {
  const findings: Finding[] = [];
  const packageName = actionInput.package_name;
  const versionSpec = actionInput.version_spec ?? "";
  const installCommand = actionInput.install_command ?? "";
  const manifestPath = actionInput.manifest_path ?? "";
  const packageManager = actionInput.package_manager ?? "";
  const reason = actionInput.reason ?? "";

  maybeAddInlineSecretFinding(findings, installCommand, "dependency_install", 1);
  maybeAddInlineSecretFinding(findings, reason, "dependency_install", 1);

  if (/postinstall|shell|proxy|eval|hook|loader|patch/i.test(packageName)) {
    findings.push({
      severity: "high",
      category: "unsafe_dependency",
      message: `Dependency "${packageName}" matches a high-risk supply-chain pattern.`,
    });
  }

  if (/git\+|https?:\/\/|file:|workspace:/i.test(versionSpec)) {
    findings.push({
      severity: "high",
      category: "unsafe_dependency",
      message: `Dependency "${packageName}" uses a non-registry source in "${versionSpec}".`,
    });
  } else if (!versionSpec || /^(latest|\*|x)$/i.test(versionSpec)) {
    findings.push({
      severity: "medium",
      category: "dependency_risk",
      message: `Dependency "${packageName}" is not pinned to a stable version.`,
    });
  } else {
    findings.push({
      severity: "info",
      category: "dependency_risk",
      message: `Dependency "${packageName}" changes the install surface and should be reviewed.`,
    });
  }

  if (/curl|wget|bash\s+-c|sh\s+-c|powershell|node\s+-e|npx/i.test(installCommand)) {
    findings.push({
      severity: "high",
      category: "dangerous_api",
      message: "Install command includes remote fetch or shell execution primitives.",
    });
  }

  if (manifestPath) {
    findings.push({
      severity: "info",
      category: "minor_config_change",
      message: `Manifest path "${manifestPath}" changes the package install surface.`,
      file: manifestPath,
    });
  }

  if (packageManager && !/^(npm|pnpm|yarn|bun)$/i.test(packageManager)) {
    findings.push({
      severity: "medium",
      category: "minor_config_change",
      message: `Package manager "${packageManager}" is uncommon and should be reviewed.`,
    });
  }

  return sortFindings(findings);
}

function analyzeDeployAction(actionInput: Extract<SigillumActionEnvelope, { action_type: "deploy_action" }>["action_input"]) {
  const findings: Finding[] = [];
  const target = actionInput.target_environment;
  const command = actionInput.deploy_command ?? "";
  const changeSummary = actionInput.change_summary ?? "";

  maybeAddInlineSecretFinding(findings, command, actionInput.service, 1);
  maybeAddInlineSecretFinding(findings, changeSummary, actionInput.service, 1);

  if (/\bprod(uction)?\b/i.test(target)) {
    findings.push({
      severity: "medium",
      category: "deploy_risk",
      message: `Deploy target "${target}" affects a production-like environment.`,
    });
  }

  if (!actionInput.artifact_ref && /\bprod(uction)?\b/i.test(target)) {
    findings.push({
      severity: "medium",
      category: "deploy_risk",
      message: "Production deploy action is missing an artifact reference.",
    });
  }

  if (/--force|--yes|--auto-approve|bash\s+-c|sh\s+-c|powershell|ssh\s|kubectl\s+apply|terraform\s+apply/i.test(command)) {
    findings.push({
      severity: "high",
      category: "deploy_risk",
      message: "Deploy command includes force flags or direct shell execution.",
    });
  }

  if (!command) {
    findings.push({
      severity: "info",
      category: "deploy_risk",
      message: "Deploy action did not include an explicit deploy command.",
    });
  }

  if (changeSummary && PROMPT_INJECTION_PATTERNS.some((pattern) => pattern.test(changeSummary))) {
    findings.push({
      severity: "medium",
      category: "prompt_injection_surface",
      message: "Deploy summary includes text that looks like prompt-injection guidance.",
    });
  }

  return sortFindings(findings);
}

function maybeAddInlineSecretFinding(
  findings: Finding[],
  content: string,
  file: string,
  lineNumber: number,
) {
  if (!content.trim()) {
    return;
  }

  const envSecret = content.match(
    /\b(?:API_KEY|SECRET|TOKEN|PASSWORD|PRIVATE_KEY|ACCESS_KEY|SESSION_SECRET)\b\s*[:=]\s*([^\s#]+)/i,
  );
  const secretLiteral = content.match(/sk_(?:live|test)_[A-Za-z0-9_-]{8,}|ghp_[A-Za-z0-9_-]{8,}|AIza[0-9A-Za-z_-]{8,}/);

  if (envSecret || secretLiteral) {
    findings.push({
      severity: "critical",
      category: "secret_exposure",
      message: "Potential secret-bearing content was included in the action payload.",
      file,
      line: lineNumber,
    });
  }
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

function sortFindings(findings: Finding[]): Finding[] {
  const severityRank: Record<SigillumSeverity, number> = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
    info: 4,
  };

  return [...findings].sort((left, right) => {
    const severityDelta = severityRank[left.severity] - severityRank[right.severity];
    if (severityDelta !== 0) {
      return severityDelta;
    }

    return left.category.localeCompare(right.category);
  });
}
