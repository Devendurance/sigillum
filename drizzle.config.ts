import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { defineConfig } from "drizzle-kit";
import { normalizePostgresConnectionString } from "./src/lib/server/database-url";

loadEnvFile(".env.local");
loadEnvFile(".env");

const databaseUrl = normalizePostgresConnectionString(
  process.env.SIGILLUM_DATABASE_URL ??
    process.env.DATABASE_URL ??
    process.env.POSTGRES_URL ??
    process.env.SUPABASE_DB_URL ??
    "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
);

export default defineConfig({
  dialect: "postgresql",
  schema: "./drizzle/schema/*.ts",
  out: "./drizzle",
  dbCredentials: {
    url: databaseUrl,
  },
});

function loadEnvFile(fileName: string) {
  const filePath = path.join(process.cwd(), fileName);
  if (!existsSync(filePath)) {
    return;
  }

  const contents = readFileSync(filePath, "utf8");
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
