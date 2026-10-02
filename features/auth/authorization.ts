import "server-only";

import { cookies } from "next/headers";
import { cache } from "react";

import { getServerApi } from "@/core/api/client/server";

import { normalizeCampusReturnTo } from "./campus-return-to";
import { readSession, type SessionRead } from "./session-read";
import type {
  RouteAuthorizationDecision,
  RouteAuthorizationRequest,
} from "./types";

const REFRESH_ATTEMPTED_COOKIE = "campus_refresh_attempted";
const INVITATION_PATH = "/invitation";
const SESSION_REFRESH_PATH = "/session/refresh";
const SIGN_IN_PATH = "/sign-in";

// Argument-free so React memoizes one backend read per server request, however
// many layouts and pages ask.
const readRequestSession = cache(async () => readSession(await getServerApi()));

function withReturnTo(path: string, returnTo: string): string {
  return `${path}?${new URLSearchParams({ returnTo }).toString()}`;
}

// campus-shell and campus-index share this policy until the cohort chooser
// adds index-specific membership rules.
function decide(
  request: RouteAuthorizationRequest,
  sessionRead: SessionRead,
  refreshAttempted: boolean,
): RouteAuthorizationDecision {
  switch (sessionRead.kind) {
    case "authenticated":
      return sessionRead.session.scope === "full_access"
        ? { kind: "allow", session: sessionRead.session }
        : { kind: "redirect", href: INVITATION_PATH };

    case "unauthenticated":
      return {
        kind: "redirect",
        href: withReturnTo(
          refreshAttempted ? SIGN_IN_PATH : SESSION_REFRESH_PATH,
          normalizeCampusReturnTo(request.returnTo),
        ),
      };

    case "forbidden":
      return { kind: "forbidden" };

    case "unavailable":
      return sessionRead;
  }
}

export async function authorizeRoute(
  request: RouteAuthorizationRequest,
): Promise<RouteAuthorizationDecision> {
  const [sessionRead, requestCookies] = await Promise.all([
    readRequestSession(),
    cookies(),
  ]);

  return decide(
    request,
    sessionRead,
    requestCookies.has(REFRESH_ATTEMPTED_COOKIE),
  );
}
