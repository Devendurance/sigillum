import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

type BalanceRole = "buyer" | "seller";

async function main() {
  const cliClient = await import(new URL("../src/lib/sigillum/cli-client.ts", import.meta.url).href);
  const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  cliClient.loadSigillumEnvFiles({ fs, path, searchDirs: [process.cwd(), projectRoot] });

  try {
    const role = parseRole(process.argv.slice(2));
    const snapshot = await cliClient.getSigillumBalanceSnapshot(role);

    console.log("SUCCESS");
    console.log(
      [
        `role=${snapshot.role}`,
        `address=${snapshot.address}`,
        `network=${snapshot.chain}`,
        `rpc=${snapshot.rpcUrl}`,
      ].join(" | "),
    );
    console.log(`wallet_usdc=${snapshot.wallet.formatted}`);

    if (snapshot.gateway) {
      console.log(
        [
          `gateway_total_usdc=${snapshot.gateway.total}`,
          `gateway_available_usdc=${snapshot.gateway.available}`,
          `gateway_withdrawing_usdc=${snapshot.gateway.withdrawing}`,
          `gateway_withdrawable_usdc=${snapshot.gateway.withdrawable}`,
        ].join(" | "),
      );
    } else {
      console.log("gateway_total_usdc=0.000000 | gateway_available_usdc=0.000000");
    }

    console.log(`status=${snapshot.gatewayStatusMessage}`);
  } catch (error) {
    if (isCliErrorShape(error)) {
      console.error("FAILURE");
      console.error(`phase=${error.phase} | summary=${error.message}`);
      if (error.detail) {
        console.error(`detail=${error.detail}`);
      }
      process.exitCode = error.exitCode;
      return;
    }

    console.error("FAILURE");
    console.error(
      `phase=runtime | summary=${error instanceof Error ? error.message : String(error)}`,
    );
    process.exitCode = 3;
  }
}

function parseRole(argv: string[]): BalanceRole {
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--role") {
      const value = argv[index + 1];
      if (value === "buyer" || value === "seller") {
        return value;
      }
    }
  }

  return "buyer";
}

function isCliErrorShape(
  error: unknown,
): error is { phase: string; message: string; detail?: string; exitCode: 3 } {
  return (
    typeof error === "object" &&
    error !== null &&
    "phase" in error &&
    "message" in error &&
    "exitCode" in error
  );
}

void main();
