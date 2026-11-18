import { ANALYTICS_EVENTS } from "@/core/analytics";
import { captureBrowserAnalyticsEvent } from "@/core/analytics/client";

import {
  createPresenceTab,
  type NoticeChannel,
  type PresenceTab,
  type PresenceTabPorts,
} from "./presence-tab";

const WINDOW_WAKE_EVENTS = ["focus", "pageshow"] as const;
const PRESENCE_TAB_EVENTS = {
  conflict_shown: ANALYTICS_EVENTS.CAMPUS_PRESENCE_TAB_CONFLICT_SHOWN,
  moved: ANALYTICS_EVENTS.CAMPUS_PRESENCE_TAB_MOVED,
} as const;

// Web Locks need a secure context; without them every tab joins on its own.
function browserLocks(): PresenceTabPorts["locks"] {
  return typeof navigator !== "undefined" && "locks" in navigator
    ? navigator.locks
    : null;
}

function openNotices(name: string, onNotice: () => void): NoticeChannel {
  if (typeof BroadcastChannel === "undefined") {
    return { close() {}, notify() {} };
  }

  const channel = new BroadcastChannel(name);
  channel.addEventListener("message", onNotice);
  return {
    close: () => channel.close(),
    notify: () => channel.postMessage("changed"),
  };
}

// A crashed holder sends no notice; the page re-probes when it is seen again.
function subscribeToWake(listener: () => void): () => void {
  const onVisible = () => {
    if (document.visibilityState === "visible") listener();
  };

  document.addEventListener("visibilitychange", onVisible);
  for (const event of WINDOW_WAKE_EVENTS) {
    window.addEventListener(event, listener);
  }

  return () => {
    document.removeEventListener("visibilitychange", onVisible);
    for (const event of WINDOW_WAKE_EVENTS) {
      window.removeEventListener(event, listener);
    }
  };
}

export function createBrowserPresenceTab(cohortId: string): PresenceTab {
  return createPresenceTab(cohortId, {
    locks: browserLocks(),
    openNotices,
    report: (event, surface) =>
      captureBrowserAnalyticsEvent(PRESENCE_TAB_EVENTS[event], { surface }),
    subscribeToWake,
  });
}
