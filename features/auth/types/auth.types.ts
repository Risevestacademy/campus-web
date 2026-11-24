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
      "id" | "email" | "displayName" | "avatarUrl" | "systemRole"
    >;
    memberships: Simplify<
      Pick<Schemas["SessionCohortPlaceDto"], "cohortId" | "cohort"> &
        Partial<Pick<Schemas["SessionCohortPlaceDto"], "role">>
    >[];
  }
>;

export type InvitationPath = "/invitation" | "/preview";

export type CampusRouteRequest =
  | {
      kind: "campus-index";
      // Where a member with only one cohort should land inside it, when the
      // visit means something more than "take me to my campus" (coming back
      // from Google with a calendar). Built by the page from values it parsed.
      destination?: (cohortId: string) => string;
    }
  | { kind: "cohort"; cohortId: string }
  | { kind: "room-link" }
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
