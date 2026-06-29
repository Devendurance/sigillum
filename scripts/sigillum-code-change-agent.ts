import * as fs from "node:fs";
import * as path from "node:path";

async function main() {
  const shared = await import(new URL("./sigillum-agent-runner-shared.ts", import.meta.url).href);
  const { cliClient } = await shared.loadRunnerModules();

  await shared.loadRunnerEnv();
  const argv = process.argv.slice(2);
  const common = shared.parseRunnerCommonArgs(argv);
  const agentArgs = parseAgentArgs(argv);

  await shared.runNamedAgent({
    agentName: "CodeChangeAgent",
    baseUrl: common.baseUrl,
    mode: common.mode,
    actionFactory: () =>
      cliClient.buildCodeChangeEnvelope(resolveDiff(agentArgs), "CodeChangeAgent", {
        repo: agentArgs.repo,
        branch: agentArgs.branch,
        commitSha: agentArgs.commitSha,
      }),
  });
}

function parseAgentArgs(argv: string[]) {
  const parsed: {
    diff?: string;
    diffFile?: string;
    repo?: string;
    branch?: string;
    commitSha?: string;
  } = {};

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    const next = argv[index + 1];
    if (!next) {
      continue;
    }

    if (token === "--diff") {
      parsed.diff = next;
      index += 1;
      continue;
    }
    if (token === "--diff-file") {
      parsed.diffFile = next;
      index += 1;
      continue;
    }
    if (token === "--repo") {
      parsed.repo = next;
      index += 1;
      continue;
    }
    if (token === "--branch") {
      parsed.branch = next;
      index += 1;
      continue;
    }
    if (token === "--commit-sha") {
      parsed.commitSha = next;
      index += 1;
    }
  }

  return parsed;
}

function resolveDiff(args: { diff?: string; diffFile?: string }) {
  if (args.diffFile) {
    return fs.readFileSync(path.resolve(process.cwd(), args.diffFile), "utf8");
  }
  if (args.diff?.trim()) {
    return args.diff;
  }

  return `diff --git a/src/agent.ts b/src/agent.ts
index 1a2b3c4..7d8e9f0 100644
--- a/src/agent.ts
+++ b/src/agent.ts
@@ -10,6 +10,7 @@
 export async function run() {
++  eval(userSuppliedScript)
   return "done"
 }`;
}

void main();
