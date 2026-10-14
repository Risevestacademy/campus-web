// SDK errors can carry the request payload; the name is enough to triage.
export function errorName(error: unknown): string {
  return error instanceof Error ? error.name : typeof error;
}
