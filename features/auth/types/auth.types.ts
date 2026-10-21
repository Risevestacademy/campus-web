import type { Route } from "next";

import type { components } from "@/core/api/client";
import type { Simplify } from "@/core/api/schemas";

type Schemas = components["schemas"];

// Only the fields routes and screens read; everything else stays out of the
// render tree.
export type Session = Simplify<
  Pick<Schemas["SessionResponseDto"], "scope" | "expiresAt" | "inviteId"> & {
    user: Pick<
      Schemas["SessionUserDto"],
      "id" | "email" | "displayName" | "systemRole"
    >;
    memberships: Pick<
      Schemas["SessionCohortPlaceDto"],
      "cohortId" | "role" | "cohort"
    >[];
  }
>;

export type InvitationPath = "/invitation" | "/preview";

export type CampusRouteRequest =
  | { kind: "campus-index" }
  | { kind: "cohort"; cohortId: string }
  | { kind: "system-admin" };

export type RouteAuthorizationRequest =
  CampusRouteRequest | { kind: "invitation"; path: InvitationPath };

export type RouteAuthorizationDecision =
  | { kind: "allow"; session: Session }
  | { kind: "redirect"; href: Route }
  | { kind: "forbidden" }
  | { kind: "unavailable"; retryHref: string; retryAfterMs?: number };

export type RouteAccess = Extract<
  RouteAuthorizationDecision,
  { kind: "allow" } | { kind: "unavailable" }
>;

export type SignInDecision =
  { kind: "render" } | { kind: "redirect"; href: Route };
