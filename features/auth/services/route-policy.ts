import type { Route } from "next";

import { normalizeReturnTo } from "../schemas/return-to";
import type {
  CampusRouteRequest,
  InvitationPath,
  RouteAuthorizationDecision,
  RouteAuthorizationRequest,
  Session,
  SignInDecision,
} from "../types/auth.types";
import type { SessionRead } from "./session.service";

const CAMPUS_HOME_PATH: Route = "/campus";
const INVITATION_PATH: Route = "/invitation";
const PREVIEW_PATH: Route = "/preview";
const INVITE_REQUIRED_PATH = "/sign-in?error=invite_required" as Route;
const SESSION_REFRESH_PATH = "/session/refresh";
const SIGN_IN_PATH = "/sign-in";

export interface RouteRequestSignals {
  enteredCampusIds: readonly string[];
  returnTo: string | undefined;
  refreshAttempted: boolean;
}

export type SignedOutSignals = Pick<
  RouteRequestSignals,
  "returnTo" | "refreshAttempted"
>;

// One automatic refresh per visit, then sign-in: the refresh-attempt marker is
// what stops a refresh/redirect loop.
export function signedOutRedirect({
  returnTo,
  refreshAttempted,
}: SignedOutSignals): Route {
  const path = refreshAttempted ? SIGN_IN_PATH : SESSION_REFRESH_PATH;
  const search = new URLSearchParams({
    returnTo: normalizeReturnTo(returnTo),
  });
  return `${path}?${search.toString()}` as Route;
}

function campusPath(cohortId: string): Route {
  return `/campus/${encodeURIComponent(cohortId)}` as Route;
}

function preJoinPath(cohortId: string): Route {
  return `${campusPath(cohortId)}/join` as Route;
}

export function preJoinRedirect(cohortId: string, returnTo: string): Route {
  const search = new URLSearchParams({ returnTo });
  return `${preJoinPath(cohortId)}?${search.toString()}` as Route;
}

// Admins and members of several cohorts choose at /campus; everyone else is
// sent straight into their one cohort and never sees the chooser.
function usesCohortChooser(session: Session): boolean {
  return session.user.systemRole === "admin" || session.memberships.length > 1;
}

export function logsOutFromRail(session: Session): boolean {
  return !usesCohortChooser(session);
}

function decideCampusIndex(
  session: Session,
  enteredCampusIds: readonly string[],
): RouteAuthorizationDecision {
  if (usesCohortChooser(session)) return { kind: "allow", session };

  const [onlyMembership] = session.memberships;
  if (!onlyMembership) return { kind: "forbidden" };

  const { cohortId } = onlyMembership;
  return {
    kind: "redirect",
    href: enteredCampusIds.includes(cohortId)
      ? campusPath(cohortId)
      : preJoinPath(cohortId),
  };
}

function decideCohort(
  session: Session,
  cohortId: string,
): RouteAuthorizationDecision {
  const mayEnter =
    session.user.systemRole === "admin" ||
    session.memberships.some((membership) => membership.cohortId === cohortId);
  return mayEnter ? { kind: "allow", session } : { kind: "forbidden" };
}

function decideFullAccess(
  request: CampusRouteRequest,
  session: Session,
  signals: RouteRequestSignals,
): RouteAuthorizationDecision {
  switch (request.kind) {
    case "campus-index":
      return decideCampusIndex(session, signals.enteredCampusIds);
    case "cohort":
      return decideCohort(session, request.cohortId);
  }
}

function decideCampus(
  request: CampusRouteRequest,
  session: Session,
  signals: RouteRequestSignals,
): RouteAuthorizationDecision {
  return session.scope === "full_access"
    ? decideFullAccess(request, session, signals)
    : { kind: "redirect", href: INVITATION_PATH };
}

// campus-api's OAuth callback lands every invitee on /invitation, which has
// nothing to show without the link's token: the invite is answered on /preview.
function decideInvitation(
  path: InvitationPath,
  session: Session,
): RouteAuthorizationDecision {
  if (session.inviteId) {
    return path === PREVIEW_PATH
      ? { kind: "allow", session }
      : { kind: "redirect", href: PREVIEW_PATH };
  }

  const href =
    session.scope === "full_access" ? CAMPUS_HOME_PATH : INVITE_REQUIRED_PATH;
  return { kind: "redirect", href };
}

function decideSignedIn(
  request: RouteAuthorizationRequest,
  session: Session,
  signals: RouteRequestSignals,
): RouteAuthorizationDecision {
  return request.kind === "invitation"
    ? decideInvitation(request.path, session)
    : decideCampus(request, session, signals);
}

export function decideRoute(
  request: RouteAuthorizationRequest,
  sessionRead: SessionRead,
  signals: RouteRequestSignals,
): RouteAuthorizationDecision {
  switch (sessionRead.kind) {
    case "authenticated":
      return decideSignedIn(request, sessionRead.session, signals);

    case "unauthenticated":
      return { kind: "redirect", href: signedOutRedirect(signals) };

    case "forbidden":
      return { kind: "forbidden" };

    case "unavailable":
      return {
        ...sessionRead,
        retryHref: normalizeReturnTo(signals.returnTo),
      };
  }
}

// Sign-in is the way out of every failed state, so anything short of a usable
// session renders it. A provisional session without an invite renders too:
// /invitation sends it here, and redirecting back would bounce forever.
export function decideSignIn(
  sessionRead: SessionRead,
  returnTo: string | undefined,
): SignInDecision {
  if (sessionRead.kind !== "authenticated") return { kind: "render" };

  const { session } = sessionRead;
  if (session.scope === "full_access") {
    return { kind: "redirect", href: normalizeReturnTo(returnTo) as Route };
  }
  return session.inviteId
    ? { kind: "redirect", href: INVITATION_PATH }
    : { kind: "render" };
}
