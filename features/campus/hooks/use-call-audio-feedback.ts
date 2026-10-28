import { useMountEffect } from "@/shared/lib/use-mount-effect";
import { toast } from "@/shared/ui/toast";

import type { CallAudioStatus } from "../services/media-session/contracts";
import { useMediaSessionStore } from "../services/media-session/media-session-provider";

const CALL_AUDIO_TOAST_ID = "call-audio";

function closeCallAudioFeedback() {
  toast.close(CALL_AUDIO_TOAST_ID);
}

// Stays until the member tries again or audio recovers. A warning, not an
// error: the member keeps the map and everything but hearing.
function reportCallAudioStatus(status: CallAudioStatus, tryAgain: () => void) {
  if (status !== "unavailable") {
    closeCallAudioFeedback();
    return;
  }

  toast.add({
    actionProps: { children: "Try again", onClick: tryAgain },
    description: "You can still move around. Try again to hear people nearby.",
    id: CALL_AUDIO_TOAST_ID,
    priority: "high",
    timeout: 0,
    title: "Audio couldn't connect",
    type: "warning",
  });
}

export function useCallAudioFeedback() {
  const store = useMediaSessionStore();

  useMountEffect(() => {
    const unsubscribe = store.subscribe((state, previous) => {
      if (state.callAudioStatus === previous.callAudioStatus) return;
      reportCallAudioStatus(state.callAudioStatus, state.retryCallAudio);
    });

    return () => {
      unsubscribe();
      closeCallAudioFeedback();
    };
  });
}
