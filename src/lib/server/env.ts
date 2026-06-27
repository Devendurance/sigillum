function readEnv(...names: string[]): string | undefined {
  for (const name of names) {
    const value = process.env[name]?.trim();
    if (value) {
      return value;
    }
  }

  return undefined;
}

function readRequiredEnv(...names: string[]): string {
  const value = readEnv(...names);
  if (!value) {
    throw new Error(`Missing required environment variable. Checked: ${names.join(", ")}`);
  }

  return value;
}

export function getDatabaseUrl(): string {
  return readRequiredEnv("DATABASE_URL", "SIGILLUM_DATABASE_URL");
}

export function getSupabaseServerEnv(): { url: string; serviceRoleKey: string } {
  return {
    url: readRequiredEnv("SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL"),
    serviceRoleKey: readRequiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
  };
}
