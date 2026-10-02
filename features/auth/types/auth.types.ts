import type { Route } from "next";

import type { components } from "@/core/api/client";

export type Session = components["schemas"]["SessionResponseDto"];

export type RouteAuthorizationRequest =
  { kind: "campus-shell" } | { kind: "campus-index" };

export type RouteAuthorizationDecision =
  | { kind: "allow"; session: Session }
  | { kind: "redirect"; href: Route }
  | { kind: "forbidden" }
  | { kind: "unavailable"; retryHref: string; retryAfterMs?: number };

export type RouteAccess = Extract<
  RouteAuthorizationDecision,
  { kind: "allow" } | { kind: "unavailable" }
>;
