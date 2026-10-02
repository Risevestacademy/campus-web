import type { ApiClient } from "@/core/api/client";

import { parseSessionBody } from "./session-schema";
import type { Session } from "./types";

export type SessionRead =
  | { kind: "authenticated"; session: Session }
  | { kind: "unauthenticated" }
  | { kind: "forbidden" }
  | { kind: "unavailable"; retryAfterMs?: number };

type Attempt = SessionRead | { kind: "transient"; retryAfterMs?: number };

const BACKOFF_MS = [200, 500] as const;
const MAX_RETRY_AFTER_MS = 2000;
const DELAY_SECONDS = /^\d+$/u;

function isTransientStatus(status: number): boolean {
  return status === 408 || status === 429 || status >= 500;
}

function parseRetryAfterMs(header: string | null): number | undefined {
  const value = header?.trim();
  if (!value) return undefined;
  if (DELAY_SECONDS.test(value)) return Number(value) * 1000;

  const retryAtMs = Date.parse(value);
  return Number.isNaN(retryAtMs)
    ? undefined
    : Math.max(0, retryAtMs - Date.now());
}

function transient(retryAfterMs?: number): Attempt {
  return retryAfterMs === undefined
    ? { kind: "transient" }
    : { kind: "transient", retryAfterMs };
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function attemptRead(api: ApiClient): Promise<Attempt> {
  let result;
  try {
    // openapi-fetch throws the same way for an unparseable body as for a
    // network failure; reading text keeps malformed sessions out of the retry.
    result = await api.GET("/v1/auth/me", { parseAs: "text" });
  } catch {
    return transient();
  }

  const { response } = result;
  if (response.status === 401) return { kind: "unauthenticated" };
  if (response.status === 403) return { kind: "forbidden" };
  if (isTransientStatus(response.status)) {
    return transient(parseRetryAfterMs(response.headers.get("retry-after")));
  }

  const session = parseSessionBody(result.data);
  return session ? { kind: "authenticated", session } : { kind: "unavailable" };
}

export async function readSession(api: ApiClient): Promise<SessionRead> {
  let attempt = await attemptRead(api);

  for (const backoffMs of BACKOFF_MS) {
    if (attempt.kind !== "transient") return attempt;

    const retryAfterMs = Math.min(
      attempt.retryAfterMs ?? 0,
      MAX_RETRY_AFTER_MS,
    );
    await wait(Math.max(backoffMs, retryAfterMs));
    attempt = await attemptRead(api);
  }

  return attempt.kind === "transient"
    ? { ...attempt, kind: "unavailable" }
    : attempt;
}
