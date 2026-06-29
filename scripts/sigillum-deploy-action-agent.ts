async function main() {
  const shared = await import(new URL("./sigillum-agent-runner-shared.ts", import.meta.url).href);
  const { cliClient } = await shared.loadRunnerModules();

  await shared.loadRunnerEnv();
  const argv = process.argv.slice(2);
  const common = shared.parseRunnerCommonArgs(argv);
  const agentArgs = parseAgentArgs(argv);

  await shared.runNamedAgent({
    agentName: "DeployActionAgent",
    baseUrl: common.baseUrl,
    mode: common.mode,
    actionFactory: () =>
      cliClient.buildDeployActionEnvelope(
        {
          service: agentArgs.service ?? "payments-api",
          target_environment: agentArgs.targetEnvironment ?? "production",
          artifact_ref: agentArgs.artifactRef ?? "ghcr.io/sigillum/payments-api:sha-abc1234",
          commit_sha: agentArgs.commitSha ?? "abc1234def5678",
          deploy_command: agentArgs.deployCommand ?? "kubectl apply -f deploy.yaml --force",
          change_summary:
            agentArgs.changeSummary ?? "Agent wants to roll out a production deploy after passing basic checks.",
        },
        "DeployActionAgent",
      ),
  });
}

function parseAgentArgs(argv: string[]) {
  const parsed: {
    service?: string;
    targetEnvironment?: string;
    artifactRef?: string;
    commitSha?: string;
    deployCommand?: string;
    changeSummary?: string;
  } = {};

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    const next = argv[index + 1];
    if (!next) {
      continue;
    }

    if (token === "--service") {
      parsed.service = next;
      index += 1;
      continue;
    }
    if (token === "--target-environment") {
      parsed.targetEnvironment = next;
      index += 1;
      continue;
    }
    if (token === "--artifact-ref") {
      parsed.artifactRef = next;
      index += 1;
      continue;
    }
    if (token === "--commit-sha") {
      parsed.commitSha = next;
      index += 1;
      continue;
    }
    if (token === "--deploy-command") {
      parsed.deployCommand = next;
      index += 1;
      continue;
    }
    if (token === "--change-summary") {
      parsed.changeSummary = next;
      index += 1;
    }
  }

  return parsed;
}

void main();
