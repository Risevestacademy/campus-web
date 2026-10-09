import "server-only";

import { cookies, headers } from "next/headers";
import { cache } from "react";

import { REFRESH_ATTEMPTED_COOKIE, SESSION_COOKIE } from "@/core/api/client";
import { getServerApi } from "@/core/api/client/server";

import type {
  InvitationPath,
  RouteAuthorizationDecision,
  RouteAuthorizationRequest,
  SignInDecision,
} from "../types/auth.types";
import { enteredCampusIds } from "./campus-entry-session";
import {
  REFRESH_ATTEMPTED_HEADER,
  RETURN_TO_HEADER,
} from "./campus-request-headers";
import {
  decideRoute,
  decideSignIn,
  type RouteRequestSignals,
} from "./route-policy";
import { readSession, type SessionRead } from "./session.service";

// Argument-free so React memoizes one backend read per server request, however
// many layouts and pages ask. No access cookie leaves nothing to ask about.
const readRequestSession = cache(async (): Promise<SessionRead> => {
  const requestCookies = await cookies();
  if (!requestCookies.has(SESSION_COOKIE)) return { kind: "unauthenticated" };
  return readSession(await getServerApi());
});

async function readCampusRequestSignals(): Promise<RouteRequestSignals> {
  const [requestHeaders, requestCookies] = await Promise.all([
    headers(),
    cookies(),
  ]);
  return {
    enteredCampusIds: enteredCampusIds(requestCookies),
    returnTo: requestHeaders.get(RETURN_TO_HEADER) ?? undefined,
    refreshAttempted: requestHeaders.has(REFRESH_ATTEMPTED_HEADER),
  };
}

// No proxy runs on these routes, so nothing clears the marker before render:
// the cookie itself is the signal, and its Max-Age ends it.
async function readInvitationSignals(
  path: InvitationPath,
): Promise<RouteRequestSignals> {
  const requestCookies = await cookies();
  return {
    enteredCampusIds: [],
    returnTo: path,
    refreshAttempted: requestCookies.has(REFRESH_ATTEMPTED_COOKIE),
  };
}

function readRequestSignals(
  request: RouteAuthorizationRequest,
): Promise<RouteRequestSignals> {
  return request.kind === "invitation"
    ? readInvitationSignals(request.path)
    : readCampusRequestSignals();
}

export async function authorizeRoute(
  request: RouteAuthorizationRequest,
): Promise<RouteAuthorizationDecision> {
  const [sessionRead, signals] = await Promise.all([
    readRequestSession(),
    readRequestSignals(request),
  ]);

  return decideRoute(request, sessionRead, signals);
}

export async function resolveSignIn(
  returnTo: string | undefined,
): Promise<SignInDecision> {
  return decideSignIn(await readRequestSession(), returnTo);
}
