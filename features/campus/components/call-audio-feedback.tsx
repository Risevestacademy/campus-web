"use client";

import { useCallAudioFeedback } from "../hooks/use-call-audio-feedback";

// Once per Presence Session, beside its audio: the media controls render on
// several surfaces at once and must never grow to explain a failure.
export function CallAudioFeedback() {
  useCallAudioFeedback();
  return null;
}
