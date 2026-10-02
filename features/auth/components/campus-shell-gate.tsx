import type { ReactNode } from "react";

import { requireRouteAccess } from "../services/route-access.service";
import { SessionUnavailable } from "./session-unavailable";

export async function CampusShellGate({ children }: { children: ReactNode }) {
  const access = await requireRouteAccess({ kind: "campus-shell" });

  return access.kind === "allow" ? (
    children
  ) : (
    <SessionUnavailable retryHref={access.retryHref} />
  );
}
