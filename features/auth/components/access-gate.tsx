import type { ReactNode } from "react";

import { requireRouteAccess } from "../services/route-access.service";
import type { RouteAuthorizationRequest } from "../types/auth.types";
import { SessionUnavailable } from "./session-unavailable";

type UnavailableView = (props: { retryHref: string }) => ReactNode;

export async function renderWithAccess(
  request: RouteAuthorizationRequest,
  children: ReactNode,
  Unavailable: UnavailableView = SessionUnavailable,
): Promise<ReactNode> {
  const access = await requireRouteAccess(request);

  return access.kind === "allow" ? (
    children
  ) : (
    <Unavailable retryHref={access.retryHref} />
  );
}
