import "server-only";

import { forbidden, redirect } from "next/navigation";

import type {
  RouteAccess,
  RouteAuthorizationRequest,
} from "../types/auth.types";
import { authorizeRoute, resolveSignIn } from "./authorization.service";

export async function requireRouteAccess(
  request: RouteAuthorizationRequest,
): Promise<RouteAccess> {
  const decision = await authorizeRoute(request);

  if (decision.kind === "redirect") redirect(decision.href);
  if (decision.kind === "forbidden") forbidden();

  return decision;
}

export async function redirectSignedInVisitor(
  returnTo: string | undefined,
): Promise<void> {
  const decision = await resolveSignIn(returnTo);
  if (decision.kind === "redirect") redirect(decision.href);
}
