import { useMountEffect } from "@/shared/lib/use-mount-effect";
import { toast } from "@/shared/ui/toast";

import type { ScreenShareState } from "../services/media-session/contracts";
import { useMediaSessionStore } from "../services/media-session/media-session-provider";

const SCREEN_SHARE_TOAST_ID = "call-screen-share";

type Outcome = NonNullable<ScreenShareState["outcome"]>;

type OutcomeNotice = Readonly<{
  description?: string;
  title: string;
  type: "info" | "warning";
}>;

// Only ends the member did not choose speak. No copy claims that anyone saw the
// screen: nobody may have been watching.
const OUTCOME_NOTICES: Partial<Readonly<Record<Outcome, OutcomeNotice>>> = {
  capture_failed: { title: "Couldn't share your screen", type: "warning" },
  meeting_ended: {
    description: "Your meeting ended.",
    title: "Screen sharing stopped",
    type: "info",
  },
  publish_failed: {
    description: "Share again to retry.",
    title: "Your screen didn't reach the call",
    type: "warning",
  },
  room_closed: {
    description: "Your call changed. Share again to continue.",
    title: "Screen sharing stopped",
    type: "info",
  },
};

function closeScreenShareFeedback() {
  toast.close(SCREEN_SHARE_TOAST_ID);
}

function reportOutcome(outcome: ScreenShareState["outcome"]) {
  const notice = outcome && OUTCOME_NOTICES[outcome];
  if (!notice) {
    closeScreenShareFeedback();
    return;
  }

  toast.add({ ...notice, id: SCREEN_SHARE_TOAST_ID, priority: "high" });
}

export function useScreenShareFeedback() {
  const store = useMediaSessionStore();

  useMountEffect(() => {
    const unsubscribe = store.subscribe(({ screenShare }, previous) => {
      if (screenShare.outcome === previous.screenShare.outcome) return;
      reportOutcome(screenShare.outcome);
    });

    return () => {
      unsubscribe();
      closeScreenShareFeedback();
    };
  });
}
