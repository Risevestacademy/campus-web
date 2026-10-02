import "server-only";

import { forbidden, redirect } from "next/navigation";

import type {
  RouteAccess,
  RouteAuthorizationRequest,
} from "../types/auth.types";
import { authorizeRoute } from "./authorization.service";

export async function requireRouteAccess(
  request: RouteAuthorizationRequest,
): Promise<RouteAccess> {
  const decision = await authorizeRoute(request);

  if (decision.kind === "redirect") redirect(decision.href);
  if (decision.kind === "forbidden") forbidden();

  return decision;
}
