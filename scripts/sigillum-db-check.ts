import * as fs from "node:fs";
import * as path from "node:path";
import postgres from "postgres";

loadEnvFiles();

const databaseUrl =
  readEnv("DATABASE_URL", "SIGILLUM_DATABASE_URL", "POSTGRES_URL", "SUPABASE_DB_URL");

if (!databaseUrl) {
  console.error("SIGILLUM DB CHECK");
  console.error("summary=Missing DATABASE_URL-compatible environment variable.");
  process.exitCode = 3;
} else {
  void main(normalizePostgresConnectionString(databaseUrl));
}

async function main(connectionString: string) {
  const sql = postgres(connectionString, {
    max: 1,
    prepare: false,
  });

  try {
    const counts = await sql<{
      agents: string;
      actions: string;
      quotes: string;
      payment_events: string;
      inspections: string;
      receipts: string;
      agent_decisions: string;
      action_events: string;
    }[]>`
      select
        (select count(*)::text from agents) as agents,
        (select count(*)::text from actions) as actions,
        (select count(*)::text from quotes) as quotes,
        (select count(*)::text from payment_events) as payment_events,
        (select count(*)::text from inspections) as inspections,
        (select count(*)::text from receipts) as receipts,
        (select count(*)::text from agent_decisions) as agent_decisions,
        (select count(*)::text from action_events) as action_events
    `;

    const latest = await sql<{
      action_id: string;
      agent_name: string;
      current_stage: string;
      amount: string | null;
      payment_reference: string | null;
      receipt_id: string | null;
      recommendation: string | null;
      agent_decision: string | null;
      created_at: string;
    }[]>`
      select
        a.public_id as action_id,
        ag.name as agent_name,
        a.current_stage,
        q.amount,
        pe.payment_reference,
        r.receipt_id,
        r.recommendation,
        ad.decision as agent_decision,
        a.created_at::text
      from actions a
      join agents ag on ag.id = a.agent_id
      left join quotes q on q.action_id = a.id
      left join lateral (
        select payment_reference
        from payment_events
        where action_id = a.id
        order by created_at desc
        limit 1
      ) pe on true
      left join lateral (
        select receipt_id, recommendation
        from receipts
        where action_id = a.id
        order by created_at desc
        limit 1
      ) r on true
      left join lateral (
        select decision
        from agent_decisions
        where action_id = a.id
        order by created_at desc
        limit 1
      ) ad on true
      order by a.created_at desc
      limit 1
    `;

    console.log("SIGILLUM DB CHECK");
    console.log(JSON.stringify({ counts: counts[0] ?? null, latest: latest[0] ?? null }, null, 2));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("SIGILLUM DB CHECK");
    console.error(`summary=${message}`);
    if (message.includes("ENOTFOUND")) {
      console.error(
        "hint=DATABASE_URL host could not be resolved from Node. For Supabase on Windows, prefer a reachable pooler or IPv4-capable Postgres connection string.",
      );
    }
    process.exitCode = 3;
  } finally {
    await sql.end({ timeout: 5 });
  }
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

function readEnv(...keys: string[]) {
  for (const key of keys) {
    const value = process.env[key]?.trim();
    if (value) {
      return value;
    }
  }

  return undefined;
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
