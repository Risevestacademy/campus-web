import { useMountEffect } from "@/shared/lib/use-mount-effect";

import {
  closeCallAudioFeedback,
  reportCallAudioStatus,
} from "../components/media-error-feedback";
import { useMediaSessionStore } from "../services/media-session/media-session-provider";

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
