export function logSigillumInfo(event: string, metadata?: Record<string, unknown>) {
  console.info(`[sigillum] ${event}`, metadata ?? {});
}

export function logSigillumError(event: string, error: unknown, metadata?: Record<string, unknown>) {
  const formattedError = formatError(error);

  console.error(
    `[sigillum] ${event}`,
    {
      ...(metadata ?? {}),
      ...formattedError,
    },
  );
}

function formatError(error: unknown): Record<string, unknown> {
  if (!(error instanceof Error)) {
    return {
      error: String(error),
    };
  }

  return {
    error: error.message,
    error_name: error.name,
    ...(hasCode(error) ? { error_code: error.code } : {}),
    ...(hasCause(error) ? { cause: error.cause } : {}),
  };
}

function hasCode(error: Error): error is Error & { code: string } {
  return "code" in error && typeof (error as { code?: unknown }).code === "string";
}

function hasCause(error: Error): error is Error & { cause: unknown } {
  return "cause" in error && (error as { cause?: unknown }).cause !== undefined;
}
