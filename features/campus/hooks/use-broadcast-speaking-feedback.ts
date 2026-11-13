import { useMountEffect } from "@/shared/lib/use-mount-effect";
import { toast } from "@/shared/ui/toast";

import { useMediaSessionStore } from "../services/media-session/media-session-provider";

const BROADCAST_SPEAKING_TOAST_ID = "broadcast-speaking";

function closeBroadcastSpeakingFeedback() {
  toast.close(BROADCAST_SPEAKING_TOAST_ID);
}

// A warning: the member still hears everything, only their voice is not
// going out to the cohort.
function showRefusedBroadcast() {
  toast.add({
    description: "Press the megaphone to try again.",
    id: BROADCAST_SPEAKING_TOAST_ID,
    priority: "high",
    timeout: 0,
    title: "Your voice isn't reaching everyone",
    type: "warning",
  });
}

export function useBroadcastSpeakingFeedback() {
  const store = useMediaSessionStore();

  useMountEffect(() => {
    const unsubscribe = store.subscribe((state, previous) => {
      if (state.broadcastSpeaking === previous.broadcastSpeaking) return;
      if (state.broadcastSpeaking === "failed") showRefusedBroadcast();
      else closeBroadcastSpeakingFeedback();
    });

    return () => {
      unsubscribe();
      closeBroadcastSpeakingFeedback();
    };
  });
}
