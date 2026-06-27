export function normalizePostgresConnectionString(connectionString: string): string {
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
