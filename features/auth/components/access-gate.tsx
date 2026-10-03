import type { ReactNode } from "react";

import { requireRouteAccess } from "../services/route-access.service";
import type { RouteAuthorizationRequest } from "../types/auth.types";
import { SessionUnavailable } from "./session-unavailable";

export async function renderWithAccess(
  request: RouteAuthorizationRequest,
  children: ReactNode,
): Promise<ReactNode> {
  const access = await requireRouteAccess(request);

  return access.kind === "allow" ? (
    children
  ) : (
    <SessionUnavailable retryHref={access.retryHref} />
  );
}
