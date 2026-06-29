async function main() {
  const shared = await import(new URL("./sigillum-agent-runner-shared.ts", import.meta.url).href);
  const { cliClient } = await shared.loadRunnerModules();

  await shared.loadRunnerEnv();
  const argv = process.argv.slice(2);
  const common = shared.parseRunnerCommonArgs(argv);
  const agentArgs = parseAgentArgs(argv);

  await shared.runNamedAgent({
    agentName: "DependencyInstallAgent",
    baseUrl: common.baseUrl,
    mode: common.mode,
    actionFactory: () =>
      cliClient.buildDependencyInstallEnvelope(
        {
          package_name: agentArgs.packageName ?? "postinstall-proxy",
          version_spec: agentArgs.versionSpec ?? "git+https://github.com/example/postinstall-proxy.git",
          package_manager: agentArgs.packageManager ?? "npm",
          manifest_path: agentArgs.manifestPath ?? "package.json",
          install_command: agentArgs.installCommand ?? "npm install postinstall-proxy",
          reason: agentArgs.reason ?? "Agent wants to add a package before continuing with a build fix.",
        },
        "DependencyInstallAgent",
      ),
  });
}

function parseAgentArgs(argv: string[]) {
  const parsed: {
    packageName?: string;
    versionSpec?: string;
    packageManager?: string;
    manifestPath?: string;
    installCommand?: string;
    reason?: string;
  } = {};

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    const next = argv[index + 1];
    if (!next) {
      continue;
    }

    if (token === "--package-name") {
      parsed.packageName = next;
      index += 1;
      continue;
    }
    if (token === "--version-spec") {
      parsed.versionSpec = next;
      index += 1;
      continue;
    }
    if (token === "--package-manager") {
      parsed.packageManager = next;
      index += 1;
      continue;
    }
    if (token === "--manifest-path") {
      parsed.manifestPath = next;
      index += 1;
      continue;
    }
    if (token === "--install-command") {
      parsed.installCommand = next;
      index += 1;
      continue;
    }
    if (token === "--reason") {
      parsed.reason = next;
      index += 1;
    }
  }

  return parsed;
}

void main();
