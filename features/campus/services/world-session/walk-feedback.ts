import { ANALYTICS_EVENTS } from "@/core/analytics";
import { captureBrowserAnalyticsEvent } from "@/core/analytics/client";
import type { ServerMessage, WalkEndedMessage } from "@/core/realtime";
import { toast } from "@/shared/ui/toast";

const WALK_ENDED_TOAST_ID = "walk-ended";

// A refused walk is the map's to tell, with the offer to ask to enter.
export function walkEndedNotice({ reason }: WalkEndedMessage): string | null {
  switch (reason) {
    case "gone":
      return "They've left the campus.";
    case "elsewhere":
      return "They can't be reached right now.";
    case "no_way":
      return "Couldn't find a way to them.";
    case "moved_by_staff":
      return "A staff member moved you out of that space.";
    default:
      return null;
  }
}

export function announceWalkEnded(message: ServerMessage) {
  if (message.type !== "walkEnded") return;

  captureBrowserAnalyticsEvent(ANALYTICS_EVENTS.CAMPUS_WORLD_GO_TO_ENDED, {
    reason: message.reason,
  });
  const title = walkEndedNotice(message);
  if (title) {
    toast.add({
      id: WALK_ENDED_TOAST_ID,
      priority: "high",
      title,
      type: "warning",
    });
  }
}
