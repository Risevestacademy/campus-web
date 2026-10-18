import type { ApiClient } from "@/core/api/client";
import type { SessionRefreshResult } from "@/core/session";
import { parseRetryAfterMs } from "@/shared/lib/retry-after";

import {
  parseRefreshExpiry,
  parseSessionBody,
} from "../schemas/session.schema";
import type { Session } from "../types/auth.types";

export type SessionRead =
  | { kind: "authenticated"; session: Session }
  | { kind: "unauthenticated" }
  | { kind: "forbidden" }
  | { kind: "unavailable"; retryAfterMs?: number };

type Attempt = SessionRead | { kind: "transient"; retryAfterMs?: number };

const ATTEMPT_TIMEOUT_MS = 3000;
const BACKOFF_MS = [200, 500] as const;
const MAX_RETRY_AFTER_MS = 2000;

function isTransientStatus(status: number): boolean {
  return status === 408 || status === 429 || status >= 500;
}

function transient(retryAfterMs?: number): Attempt {
  return retryAfterMs === undefined
    ? { kind: "transient" }
    : { kind: "transient", retryAfterMs };
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Not AbortSignal.timeout: it runs on an internal timer that fake timers cannot
// advance, which would leave the hang path untestable.
function abortAfter(ms: number): { signal: AbortSignal; cancel: () => void } {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return { signal: controller.signal, cancel: () => clearTimeout(timer) };
}

// Next replays an identical GET made during the same render unless fetch()
// receives a signal in its init argument. openapi-fetch passes only a Request,
// so without this every retry would return the first attempt's response.
function fetchOutsideRenderDedupe(request: Request): Promise<Response> {
  return fetch(request, { signal: request.signal });
}

async function attemptRead(api: ApiClient): Promise<Attempt> {
  const timeout = abortAfter(ATTEMPT_TIMEOUT_MS);
  let result;
  try {
    // openapi-fetch throws the same way for an unparseable body as for a
    // network failure; reading text keeps malformed sessions out of the retry.
    result = await api.GET("/v1/auth/me", {
      fetch: fetchOutsideRenderDedupe,
      parseAs: "text",
      signal: timeout.signal,
    });
  } catch {
    return transient();
  } finally {
    timeout.cancel();
  }

  const { response } = result;
  if (response.status === 401) return { kind: "unauthenticated" };
  if (response.status === 403) return { kind: "forbidden" };
  if (isTransientStatus(response.status)) {
    return transient(
      parseRetryAfterMs(response.headers.get("retry-after"), Date.now()),
    );
  }

  const session = parseSessionBody(result.data);
  return session ? { kind: "authenticated", session } : { kind: "unavailable" };
}

export async function readSession(api: ApiClient): Promise<SessionRead> {
  let attempt = await attemptRead(api);

  for (const backoffMs of BACKOFF_MS) {
    if (attempt.kind !== "transient") return attempt;

    const retryAfterMs = attempt.retryAfterMs ?? 0;
    if (retryAfterMs > MAX_RETRY_AFTER_MS) {
      return { kind: "unavailable", retryAfterMs };
    }
    await wait(Math.max(backoffMs, retryAfterMs));
    attempt = await attemptRead(api);
  }

  return attempt.kind === "transient"
    ? { ...attempt, kind: "unavailable" }
    : attempt;
}

// The OpenAPI document marks this body required, but campus-api reads the
// refresh cookie first and ignores the body; only native clients send a token.
const COOKIE_CARRIES_TOKEN = {};

// One refresh contract for every caller: core/session owns its shape.
export type SessionRefresh = SessionRefreshResult;

async function postRefresh(api: ApiClient): Promise<SessionRefresh> {
  try {
    const { data, response } = await api.POST("/v1/auth/refresh", {
      body: COOKIE_CARRIES_TOKEN,
      parseAs: "text",
    });
    if (response.ok) {
      return { kind: "refreshed", expiresAt: parseRefreshExpiry(data) };
    }
    if (response.status === 401) return { kind: "expired" };

    const retryAfterMs = parseRetryAfterMs(
      response.headers.get("retry-after"),
      Date.now(),
    );
    return { kind: "failed", retryAfterMs };
  } catch {
    return { kind: "failed" };
  }
}

export type Serialize = <T>(task: () => Promise<T>) => Promise<T>;

const runNow: Serialize = (task) => task();

// The refresh token rotates, so a second concurrent POST would spend an
// already-spent token and sign the visitor out. Concurrent callers (including
// React StrictMode's double mount in development) share one request, which
// serialize can queue behind other tabs.
export function createSessionRefresher(
  api: ApiClient,
  serialize: Serialize = runNow,
): () => Promise<SessionRefresh> {
  let inFlight: Promise<SessionRefresh> | undefined;

  return () => {
    inFlight ??= serialize(() => postRefresh(api)).finally(() => {
      inFlight = undefined;
    });
    return inFlight;
  };
}

export type SessionEnd = { kind: "ended" } | { kind: "failed" };

// 401 means the session had already ended, which is what logging out wants.
export async function endSession(api: ApiClient): Promise<SessionEnd> {
  try {
    const { response } = await api.POST("/v1/auth/logout", {
      body: COOKIE_CARRIES_TOKEN,
      parseAs: "stream",
    });
    return response.ok || response.status === 401
      ? { kind: "ended" }
      : { kind: "failed" };
  } catch {
    return { kind: "failed" };
  }
}
