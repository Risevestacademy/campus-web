import type { Route } from "next";

import type { components } from "@/core/api/client";

type GeneratedSession = components["schemas"]["SessionResponseDto"];
type GeneratedSessionUser = GeneratedSession["user"];

export type SystemRole = components["schemas"]["SystemRole"] | "super_admin";

export type Session = Omit<GeneratedSession, "user"> & {
  user: Omit<GeneratedSessionUser, "systemRole"> & {
    systemRole: SystemRole;
  };
};

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
