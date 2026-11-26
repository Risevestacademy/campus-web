import { type MouseEvent, useState } from "react";

import { useRefreshSession } from "@/core/session";

// Connecting leaves the app for Google and returns through campus-api's
// callback, which needs the session that started it. So the session is renewed
// first, and the page only goes once that has settled; if it could not renew,
// it goes anyway and the callback sends back `unauthorized`, which says so.
export const CONNECT_CALENDAR_HREF = "/api/v1/calendar/connect";

export function useConnectCalendar() {
  const refreshSession = useRefreshSession();
  const [leaving, setLeaving] = useState(false);

  async function connect(event: MouseEvent<HTMLAnchorElement>) {
    // A new tab or window keeps its own default: it is a plain link.
    if (
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }
    event.preventDefault();
    if (leaving) return;

    setLeaving(true);
    try {
      await refreshSession();
    } catch {
      // Nothing to do: the callback will say the session ran out.
    }
    window.location.assign(CONNECT_CALENDAR_HREF);
  }

  return { connect, leaving };
}
