import { renderWithAccess } from "./access-gate";
import { SessionUnavailableNotice } from "./session-unavailable";

// /invitation without the link's token: the route policy sends a session
// carrying an invite on to /preview, and everyone else to refresh or sign-in.
// Nothing renders here except the outage notice.
export async function ResumeInvitation() {
  return renderWithAccess(
    { kind: "invitation", path: "/invitation" },
    null,
    SessionUnavailableNotice,
  );
}
