import { parseRetryAfterMs } from "@/shared/lib/retry-after";

import {
  isMediaNotConfigured,
  parseConnectionCheckGrant,
} from "../../schemas/connection-check.schema";
import { pinMediaUrl } from "./media-origin";

export type ConnectionCheckAccess =
  | { kind: "ready"; url: string; token: string }
  | { kind: "unavailable" }
  | { kind: "rate-limited"; retryAfterSeconds: number }
  | { kind: "signed-out" }
  | { kind: "failed" };

export interface ConnectionCheckDependencies {
  fetch: typeof globalThis.fetch;
  worldOrigin: string;
  mediaOrigin: string | undefined;
  now?: () => number;
}

// world allows WORLD_CONNECTION_CHECKS_PER_MINUTE per account.
const RATE_LIMIT_WINDOW_SECONDS = 60;

const FAILED: ConnectionCheckAccess = { kind: "failed" };

async function readJson(response: Response): Promise<unknown> {
  return response.json().catch(() => undefined);
}

async function readGrant(
  response: Response,
  mediaOrigin: string,
): Promise<ConnectionCheckAccess> {
  const grant = parseConnectionCheckGrant(await readJson(response));
  const url = grant && pinMediaUrl(grant.url, mediaOrigin);

  return grant && url ? { kind: "ready", url, token: grant.token } : FAILED;
}

function retryAfterSeconds(response: Response, nowMs: number): number {
  const waitMs = parseRetryAfterMs(response.headers.get("retry-after"), nowMs);

  return waitMs === undefined
    ? RATE_LIMIT_WINDOW_SECONDS
    : Math.max(1, Math.ceil(waitMs / 1000));
}

async function readRefusal(
  response: Response,
  nowMs: number,
): Promise<ConnectionCheckAccess> {
  switch (response.status) {
    case 401:
      return { kind: "signed-out" };
    case 429:
      return {
        kind: "rate-limited",
        retryAfterSeconds: retryAfterSeconds(response, nowMs),
      };
    case 503:
      return isMediaNotConfigured(await readJson(response))
        ? { kind: "unavailable" }
        : FAILED;
    default:
      return FAILED;
  }
}

async function postConnectionCheck(
  { fetch, worldOrigin }: ConnectionCheckDependencies,
  signal: AbortSignal | undefined,
): Promise<Response | undefined> {
  try {
    return await fetch(new URL("/media/connection-check", worldOrigin), {
      method: "POST",
      credentials: "include",
      cache: "no-store",
      signal,
    });
  } catch {
    signal?.throwIfAborted();
    // The browser reports a CORS refusal and being offline as the same
    // TypeError, so neither can be named more precisely than failed.
    return undefined;
  }
}

export async function requestConnectionCheck(
  dependencies: ConnectionCheckDependencies,
  signal?: AbortSignal,
): Promise<ConnectionCheckAccess> {
  const { mediaOrigin, now = Date.now } = dependencies;

  if (!mediaOrigin) {
    return { kind: "unavailable" };
  }

  const response = await postConnectionCheck(dependencies, signal);

  if (!response) {
    return FAILED;
  }

  return response.ok
    ? readGrant(response, mediaOrigin)
    : readRefusal(response, now());
}
