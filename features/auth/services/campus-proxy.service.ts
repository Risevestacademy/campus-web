import { type NextRequest, NextResponse } from "next/server";

import { REFRESH_ATTEMPTED_COOKIE, SESSION_COOKIE } from "@/core/api/client";

import { normalizeCampusReturnTo } from "../schemas/return-to";
import {
  REFRESH_ATTEMPTED_HEADER,
  RETURN_TO_HEADER,
} from "./campus-request-headers";
import { type CampusRequestSignals, signedOutRedirect } from "./route-policy";

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

// Cookie presence only, never a backend call: authorizeRoute's
// GET /v1/auth/me is the real check.
export function guardCampusRequest(request: NextRequest): NextResponse {
  const signals = readSignals(request);

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
