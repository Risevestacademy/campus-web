import type { Route } from "next";
import { type NextRequest, NextResponse } from "next/server";

import { REFRESH_ATTEMPTED_COOKIE, SESSION_COOKIE } from "@/core/api/client";

import {
  activeCampusCohort,
  normalizeCampusReturnTo,
} from "../schemas/return-to";
import {
  REFRESH_ATTEMPTED_HEADER,
  RETURN_TO_HEADER,
} from "./campus-request-headers";
import {
  type CampusRequestSignals,
  preJoinRedirect,
  signedOutRedirect,
} from "./route-policy";

const REFRESH_ATTEMPTED_COOKIE_PATH = "/campus";

type ProxySignals = CampusRequestSignals & { returnTo: string };

function readSignals(request: NextRequest): ProxySignals {
  const { pathname, search } = request.nextUrl;
  return {
    returnTo: normalizeCampusReturnTo(`${pathname}${search}`),
    refreshAttempted: request.cookies.has(REFRESH_ATTEMPTED_COOKIE),
  };
}

function renderHeaders(
  request: NextRequest,
  { returnTo, refreshAttempted }: ProxySignals,
): Headers {
  const headers = new Headers(request.headers);
  headers.set(RETURN_TO_HEADER, returnTo);
  if (refreshAttempted) headers.set(REFRESH_ATTEMPTED_HEADER, "1");
  else headers.delete(REFRESH_ATTEMPTED_HEADER);
  return headers;
}

function isDocumentNavigation(request: NextRequest): boolean {
  return (
    request.method === "GET" &&
    request.headers.get("sec-fetch-dest") === "document"
  );
}

// Router fetches send Sec-Fetch-Dest: empty and pass, so soft navigation
// inside an entered campus keeps its media session.
function preJoinDestination(
  request: NextRequest,
  { returnTo }: ProxySignals,
): Route | undefined {
  const cohortId = activeCampusCohort(request.nextUrl.pathname);
  return cohortId !== undefined && isDocumentNavigation(request)
    ? preJoinRedirect(cohortId, returnTo)
    : undefined;
}

// Cookie presence only, never a backend call: authorizeRoute's
// GET /v1/auth/me is the real check.
export function guardCampusRequest(request: NextRequest): NextResponse {
  const signals = readSignals(request);

  // Ahead of the session check so a refresh or sign-in round trip returns
  // through /join; the refresh marker is left for that /join request.
  const preJoin = preJoinDestination(request, signals);
  if (preJoin) return NextResponse.redirect(new URL(preJoin, request.url));

  const response = request.cookies.has(SESSION_COOKIE)
    ? NextResponse.next({
        request: { headers: renderHeaders(request, signals) },
      })
    : NextResponse.redirect(new URL(signedOutRedirect(signals), request.url));

  if (signals.refreshAttempted) {
    response.cookies.delete({
      name: REFRESH_ATTEMPTED_COOKIE,
      path: REFRESH_ATTEMPTED_COOKIE_PATH,
    });
  }

  return response;
}
