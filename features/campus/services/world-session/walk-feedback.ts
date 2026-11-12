import { ANALYTICS_EVENTS } from "@/core/analytics";
import { captureBrowserAnalyticsEvent } from "@/core/analytics/client";
import { type Presence, refusedEntryNotice } from "@/core/presence";
import type { ServerMessage, WalkEndedMessage } from "@/core/realtime";
import { toast } from "@/shared/ui/toast";

const WALK_ENDED_TOAST_ID = "walk-ended";

export function walkEndedNotice(
  { reason, spaceKey }: WalkEndedMessage,
  presence: Parameters<typeof refusedEntryNotice>[0],
): string | null {
  switch (reason) {
    case "refused":
      return refusedEntryNotice(presence, spaceKey);
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

export function announceWalkEnded(message: ServerMessage, presence: Presence) {
  if (message.type !== "walkEnded") return;

  captureBrowserAnalyticsEvent(ANALYTICS_EVENTS.CAMPUS_WORLD_GO_TO_ENDED, {
    reason: message.reason,
  });
  const title = walkEndedNotice(message, presence);
  if (title) {
    toast.add({
      id: WALK_ENDED_TOAST_ID,
      priority: "high",
      title,
      type: "warning",
    });
  }
}
