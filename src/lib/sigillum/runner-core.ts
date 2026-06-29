import type { SigillumActionEnvelope } from "./lifecycle";
import type { SigillumInspectResult } from "./cli-client";
import { createSigillumClient } from "./cli-client";

export type SigillumRunnerMode = {
  once: boolean;
  intervalMs?: number;
  maxRuns?: number;
};

export type SigillumRunnerOptions = {
  baseUrl: string;
  agentName: string;
  allowDemoConfirm?: boolean;
};

export async function runSigillumRunner({
  actionFactory,
  mode,
  clientOptions,
  onResult,
}: {
  actionFactory: () => SigillumActionEnvelope | Promise<SigillumActionEnvelope>;
  mode: SigillumRunnerMode;
  clientOptions: SigillumRunnerOptions;
  onResult?: (result: SigillumInspectResult, envelope: SigillumActionEnvelope) => void | Promise<void>;
}) {
  const client = createSigillumClient({
    baseUrl: clientOptions.baseUrl,
    allowDemoConfirm: clientOptions.allowDemoConfirm,
    agentName: clientOptions.agentName,
  });

  const executeOnce = async () => {
    const envelope = await actionFactory();
    const result = await client.inspectAction({
      envelope,
      allowDemoConfirm: clientOptions.allowDemoConfirm,
    });

    if (onResult) {
      await onResult(result, envelope);
    }

    return result;
  };

  if (mode.once || !mode.intervalMs || mode.intervalMs <= 0) {
    return [await executeOnce()];
  }

  const results: SigillumInspectResult[] = [];
  while (mode.maxRuns === undefined || results.length < mode.maxRuns) {
    results.push(await executeOnce());
    await sleep(mode.intervalMs);
  }

  return results;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
