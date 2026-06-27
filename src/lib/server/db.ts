import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { getDatabaseUrl } from "./env";
import * as schema from "../../../drizzle/schema/sigillum";
import { logSigillumError, logSigillumInfo } from "./sigillum-log";
import { normalizePostgresConnectionString } from "./database-url";

declare global {
  var __sigillumSqlClient: ReturnType<typeof postgres> | undefined;
}

const sqlClient = globalThis.__sigillumSqlClient ?? createSqlClient();

if (process.env.NODE_ENV !== "production") {
  globalThis.__sigillumSqlClient = sqlClient;
}

export const db = drizzle(sqlClient, { schema });
export { sqlClient };

function createSqlClient() {
  try {
    const databaseUrl = normalizePostgresConnectionString(getDatabaseUrl());
    const databaseHost = readDatabaseHost(databaseUrl);

    logSigillumInfo("db.bootstrap", {
      driver: "postgres",
      database_url_configured: true,
      database_host: databaseHost,
    });

    return postgres(databaseUrl, {
      max: 1,
      prepare: false,
    });
  } catch (error) {
    logSigillumError("db.bootstrap_failed", error, {
      database_url_configured: false,
    });
    throw error;
  }
}

function readDatabaseHost(connectionString: string) {
  try {
    return new URL(connectionString).host;
  } catch {
    return "unparseable";
  }
}
