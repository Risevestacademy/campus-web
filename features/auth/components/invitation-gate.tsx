import type { ReactNode } from "react";

import type { InvitationPath } from "../types/auth.types";
import { renderWithAccess } from "./access-gate";
import { SessionUnavailableNotice } from "./session-unavailable";

// The auth layout already provides <main>, so the outage state renders without
// a landmark of its own.
export async function InvitationGate({
  path,
  children,
}: {
  path: InvitationPath;
  children: ReactNode;
}) {
  return renderWithAccess(
    { kind: "invitation", path },
    children,
    SessionUnavailableNotice,
  );
}
