/**
 * Format error message consistently
 */
export function formatError(prefix: string, error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return `${prefix}: ${message}`;
}
