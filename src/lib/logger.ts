type LogLevel = "info" | "warn" | "error";

export function logMessage(
  level: LogLevel,
  message: string,
  metadata?: Record<string, unknown>,
) {
  const payload = metadata ? ` ${JSON.stringify(metadata)}` : "";
  const line = `[sales-agent:${level}] ${message}${payload}`;

  if (level === "error") {
    console.error(line);
    return;
  }

  if (level === "warn") {
    console.warn(line);
    return;
  }

  console.info(line);
}
