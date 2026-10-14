import { type NextRequest, NextResponse } from "next/server";

import { parseInviteToken } from "../schemas/invite-token.schema";
import { INVITATION_PATH, INVITE_TOKEN_COOKIE } from "./invite-token-cookie";

const INVITE_TOKEN_PARAM = "token";
const INVITE_TOKEN_COOKIE_MAX_AGE_SECONDS = 30 * 60;

function cleanInvitationUrl(request: NextRequest): URL {
  return new URL(INVITATION_PATH, request.url);
}

function inviteTokenCookie(token: string, request: NextRequest) {
  return {
    name: INVITE_TOKEN_COOKIE,
    value: token,
    httpOnly: true,
    maxAge: INVITE_TOKEN_COOKIE_MAX_AGE_SECONDS,
    path: INVITATION_PATH,
    sameSite: "lax",
    secure: request.nextUrl.protocol === "https:",
  } as const;
}

// Runs before any HTML, so analytics, browser history, and Referer only ever
// see the clean /invitation. An unusable token clears any earlier invite
// rather than showing it.
export function moveInviteTokenToCookie(request: NextRequest): NextResponse {
  const { searchParams } = request.nextUrl;
  if (!searchParams.has(INVITE_TOKEN_PARAM)) return NextResponse.next();

  const response = NextResponse.redirect(cleanInvitationUrl(request), 303);
  const token = parseInviteToken(searchParams.get(INVITE_TOKEN_PARAM));
  if (token) response.cookies.set(inviteTokenCookie(token, request));
  else
    response.cookies.delete({
      name: INVITE_TOKEN_COOKIE,
      path: INVITATION_PATH,
    });
  return response;
}
