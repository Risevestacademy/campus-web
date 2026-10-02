import type { components } from "@/core/api/client";

export type Session = components["schemas"]["SessionResponseDto"];

export type RouteAuthorizationRequest =
  | { kind: "campus-shell"; returnTo: string }
  | { kind: "campus-index"; returnTo: string };

export type RouteAuthorizationDecision =
  | { kind: "allow"; session: Session }
  | { kind: "redirect"; href: string }
  | { kind: "forbidden" }
  | { kind: "unavailable"; retryAfterMs?: number };
