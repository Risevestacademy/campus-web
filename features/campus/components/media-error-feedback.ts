import { toast } from "@/shared/ui/toast";

import type {
  CallAudioStatus,
  CaptureSource,
  MediaSessionErrorCode,
} from "../services/media-session/contracts";

type MediaFeedback = Readonly<{ description: string; title: string }>;

const FEEDBACK_TIMEOUT_MS = 7000;
const SPEAKER_TOAST_ID = "media-output";
const CALL_AUDIO_TOAST_ID = "call-audio";

const sourceNames = {
  camera: { lower: "camera", title: "Camera" },
  microphone: { lower: "microphone", title: "Microphone" },
} as const satisfies Record<CaptureSource, { lower: string; title: string }>;

function getSourceToastId(source: CaptureSource) {
  return `media-${source}`;
}

function showFailure(id: string, feedback: MediaFeedback) {
  toast.add({
    ...feedback,
    id,
    priority: "high",
    timeout: FEEDBACK_TIMEOUT_MS,
    type: "error",
  });
}

export function describeBlockedAccess(source: CaptureSource) {
  const { lower, title } = sourceNames[source];

  return {
    description: `Allow ${lower} access in your browser settings, then try again.`,
    retryLabel: `Try ${lower} again`,
    title: `${title} access is blocked`,
  } as const;
}

export function describeSourceFailure(
  source: CaptureSource,
  error: MediaSessionErrorCode,
): MediaFeedback {
  const { lower, title } = sourceNames[source];

  switch (error) {
    case "device-unavailable":
      return {
        description: `Choose another ${lower} from settings, then try again.`,
        title: `${title} is unavailable`,
      };
    case "device-unreadable":
      return {
        description: `Another application may be using your ${lower}.`,
        title: `${title} couldn't start`,
      };
    case "permission-denied":
      return {
        description: describeBlockedAccess(source).description,
        title: `${title} is blocked`,
      };
    case "unsupported":
      return {
        description: `${title} capture is not supported in this browser.`,
        title: `${title} is unsupported`,
      };
    case "unknown":
      return {
        description: `Check your ${lower}, then try again.`,
        title: `${title} couldn't start`,
      };
  }
}

export function reportSourceResult(
  source: CaptureSource,
  error: MediaSessionErrorCode | null,
) {
  const id = getSourceToastId(source);

  if (!error) {
    toast.close(id);
    return;
  }

  showFailure(id, describeSourceFailure(source, error));
}

export function reportSwitchResult(
  source: CaptureSource,
  error: MediaSessionErrorCode | null,
  hadActiveTrack: boolean,
) {
  if (!error || !hadActiveTrack) {
    reportSourceResult(source, error);
    return;
  }

  const { lower } = sourceNames[source];
  showFailure(getSourceToastId(source), {
    description: `Your previous ${lower} is still on.`,
    title: `Couldn't switch ${lower}`,
  });
}

// The speaker picker rejects with NotAllowedError when the user dismisses it,
// which is a choice, not a failure worth interrupting them for.
export function reportSpeakerResult(error: MediaSessionErrorCode | null) {
  if (!error) {
    toast.close(SPEAKER_TOAST_ID);
    return;
  }

  if (error === "permission-denied") return;

  showFailure(SPEAKER_TOAST_ID, {
    description: "Audio keeps playing through your current speaker.",
    title: "Couldn't choose a speaker",
  });
}

export function closeCallAudioFeedback() {
  toast.close(CALL_AUDIO_TOAST_ID);
}

// Stays until the member tries again or audio recovers. A warning, not an
// error: the member keeps the map and everything but hearing.
export function reportCallAudioStatus(
  status: CallAudioStatus,
  tryAgain: () => void,
) {
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
