import * as fs from "node:fs";
import * as path from "node:path";
import postgres from "postgres";

loadEnvFiles();

const databaseUrl =
  readEnv("DATABASE_URL", "SIGILLUM_DATABASE_URL", "POSTGRES_URL", "SUPABASE_DB_URL");

if (!databaseUrl) {
  throw new Error("Missing DATABASE_URL-compatible environment variable for backfill.");
}

const sql = postgres(normalizePostgresConnectionString(databaseUrl), {
  max: 1,
  prepare: false,
});

const { resolveSigillumSettlementProof } = await import(
  new URL("../src/lib/server/sigillum-payment-provenance.ts", import.meta.url).href
);

const paymentEvents = await sql<{
  id: string;
  payment_reference: string | null;
}[]>`
  select id, payment_reference
  from payment_events
  where stage = 'payment_confirmed'
  order by created_at desc
`;

let resolvedCount = 0;
let updatedCount = 0;
for (const event of paymentEvents) {
  if (!event.payment_reference) {
    continue;
  }

  const proof = await resolveSigillumSettlementProof({
    paymentReference: event.payment_reference,
    source: "manual_backfill",
  });

  await sql`
    update payment_events
    set transaction_hash = ${proof.transaction_hash},
        settlement_status = ${proof.settlement_status},
        settlement_scope = ${proof.settlement_scope},
        settlement_source = ${proof.settlement_source},
        transaction_confirmed_at = ${proof.transaction_confirmed_at ? new Date(proof.transaction_confirmed_at) : null},
        gateway_transfer_json = ${proof.gateway_transfer_json ? JSON.stringify(proof.gateway_transfer_json) : null}::jsonb,
        batch_reference = ${proof.batch_reference},
        settlement_last_checked_at = ${new Date(proof.settlement_last_checked_at)}
    where id = ${event.id}
  `;

  updatedCount += 1;
  if (proof.transaction_hash) {
    resolvedCount += 1;
  }

  console.log(
    JSON.stringify({
      payment_event_id: event.id,
      payment_reference: event.payment_reference,
      transaction_hash: proof.transaction_hash,
      settlement_status: proof.settlement_status,
      settlement_scope: proof.settlement_scope,
      settlement_source: proof.settlement_source,
      batch_reference: proof.batch_reference,
    }),
  );
}

console.log(
  JSON.stringify({
    scanned: paymentEvents.length,
    updated: updatedCount,
    resolved: resolvedCount,
    unresolved: updatedCount - resolvedCount,
  }),
);

await sql.end({ timeout: 5 });

function readEnv(...keys: string[]) {
  for (const key of keys) {
    const value = process.env[key]?.trim();
    if (value) {
      return value;
    }
  }

  return undefined;
}

function loadEnvFiles() {
  for (const fileName of [".env.local", ".env"]) {
    const filePath = path.join(process.cwd(), fileName);
    if (!fs.existsSync(filePath)) {
      continue;
    }

    const contents = fs.readFileSync(filePath, "utf8");
    for (const line of contents.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) {
        continue;
      }

      const separator = trimmed.indexOf("=");
      if (separator <= 0) {
        continue;
      }

      const key = trimmed.slice(0, separator).trim();
      if (!key || process.env[key] !== undefined) {
        continue;
      }

      let value = trimmed.slice(separator + 1).trim();
      if (
        (value.startsWith("\"") && value.endsWith("\"")) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }

      process.env[key] = value;
    }
  }
}

function normalizePostgresConnectionString(connectionString: string): string {
  try {
    return new URL(connectionString).toString();
  } catch {
    const match = connectionString.match(/^(postgres(?:ql)?:\/\/)([^:/?#]+):([^@]+)@(.+)$/i);
    if (!match) {
      return connectionString;
    }

    const [, protocol, username, password, rest] = match;
    return `${protocol}${encodeURIComponent(username)}:${encodeURIComponent(password)}@${rest}`;
  }
}
