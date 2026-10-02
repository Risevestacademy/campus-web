import type { Route } from "next";

import { normalizeCampusReturnTo } from "../schemas/return-to";
import type {
  RouteAuthorizationDecision,
  RouteAuthorizationRequest,
  Session,
} from "../types/auth.types";
import type { SessionRead } from "./session.service";

const INVITATION_PATH: Route = "/invitation";
const SESSION_REFRESH_PATH = "/session/refresh";
const SIGN_IN_PATH = "/sign-in";

export interface CampusRequestSignals {
  returnTo: string | undefined;
  refreshAttempted: boolean;
}

// One automatic refresh per visit, then sign-in: the refresh-attempt marker is
// what stops a refresh/redirect loop.
export function signedOutRedirect({
  returnTo,
  refreshAttempted,
}: CampusRequestSignals): Route {
  const path = refreshAttempted ? SIGN_IN_PATH : SESSION_REFRESH_PATH;
  const search = new URLSearchParams({
    returnTo: normalizeCampusReturnTo(returnTo),
  });
  return `${path}?${search.toString()}` as Route;
}

function preJoinPath(cohortId: string): Route {
  return `/campus/${encodeURIComponent(cohortId)}/join` as Route;
}

function decideCampusIndex(session: Session): RouteAuthorizationDecision {
  if (session.user.systemRole === "admin") return { kind: "allow", session };

  const [onlyMembership, ...otherMemberships] = session.memberships;
  if (!onlyMembership) return { kind: "forbidden" };
  if (otherMemberships.length > 0) return { kind: "allow", session };

  return { kind: "redirect", href: preJoinPath(onlyMembership.cohortId) };
}

function decideFullAccess(
  request: RouteAuthorizationRequest,
  session: Session,
): RouteAuthorizationDecision {
  return request.kind === "campus-index"
    ? decideCampusIndex(session)
    : { kind: "allow", session };
}

export function decideRoute(
  request: RouteAuthorizationRequest,
  sessionRead: SessionRead,
  signals: CampusRequestSignals,
): RouteAuthorizationDecision {
  switch (sessionRead.kind) {
    case "authenticated":
      return sessionRead.session.scope === "full_access"
        ? decideFullAccess(request, sessionRead.session)
        : { kind: "redirect", href: INVITATION_PATH };

    case "unauthenticated":
      return { kind: "redirect", href: signedOutRedirect(signals) };

    case "forbidden":
      return { kind: "forbidden" };

    case "unavailable":
      return {
        ...sessionRead,
        retryHref: normalizeCampusReturnTo(signals.returnTo),
      };
  }
}
