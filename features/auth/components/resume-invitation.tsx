import { renderWithAccess } from "./access-gate";
import { SessionUnavailableNotice } from "./session-unavailable";

// /invitation without the link's token, for a visitor with a session: the
// route policy sends an invite on to /preview and the rest to Campus or
// sign-in. Nothing renders here except the outage notice.
export async function ResumeInvitation() {
  return renderWithAccess(
    { kind: "invitation", path: "/invitation" },
    null,
    SessionUnavailableNotice,
  );
}
