import type {
  LocalMediaPublication,
  LocalPublicationChange,
  ScreenShareEndReason,
  ScreenShareState,
} from "./contracts";

const SCREEN_PUBLICATION_ID = "local-screen";

// selfBrowserSurface is newer than TypeScript's DOM types. Offering this tab
// would show the campus inside itself.
const SCREEN_CONSTRAINTS: DisplayMediaStreamOptions & {
  selfBrowserSurface: "exclude";
} = {
  audio: false,
  selfBrowserSurface: "exclude",
  video: {
    frameRate: { ideal: 15, max: 15 },
    height: { max: 1080 },
    width: { max: 1920 },
  },
};

export const IDLE_SCREEN_SHARE: ScreenShareState = {
  outcome: null,
  status: "idle",
};

export function supportsScreenCapture(mediaDevices: MediaDevices | undefined) {
  return typeof mediaDevices?.getDisplayMedia === "function";
}

// Dismissing the picker and denying it raise the same error, so neither speaks.
// A block in the operating system's settings differs only in Chromium's wording.
function outcomeOfCaptureError(error: unknown): ScreenShareState["outcome"] {
  if (!(error instanceof DOMException) || error.name !== "NotAllowedError") {
    return "capture_failed";
  }
  return /by system/i.test(error.message) ? "capture_blocked" : null;
}

type ScreenShareDependencies = Readonly<{
  mediaDevices: MediaDevices | undefined;
  onLocalChange: (change: LocalPublicationChange) => void;
  onStateChange: (state: ScreenShareState) => void;
}>;

type LiveCapture = Readonly<{
  onEnded: () => void;
  track: MediaStreamTrack;
}>;

export function createScreenShare({
  mediaDevices,
  onLocalChange,
  onStateChange,
}: ScreenShareDependencies) {
  let status: ScreenShareState["status"] = "idle";
  let live: LiveCapture | undefined;
  let requestVersion = 0;

  function report(state: ScreenShareState) {
    status = state.status;
    onStateChange(state);
  }

  function accept(stream: MediaStream, version: number) {
    const [track] = stream.getVideoTracks();
    const keep = version === requestVersion ? track : undefined;
    stream
      .getTracks()
      .filter((candidate) => candidate !== keep)
      .forEach((candidate) => candidate.stop());
    if (version !== requestVersion) return;
    if (!track) throw new DOMException("No screen track.", "NotFoundError");

    track.contentHint = "detail";
    const onEnded = () => end("browser_stopped");
    track.addEventListener("ended", onEnded);
    live = { onEnded, track };
    const publication: LocalMediaPublication = {
      enabled: track.enabled,
      origin: "local",
      publicationId: SCREEN_PUBLICATION_ID,
      source: "screen",
      stream,
      track,
    };
    report({ outcome: null, publication, status: "sharing" });
    onLocalChange({ publication, type: "added" });
  }

  // Runs up to the picker without yielding: the browser only opens it while
  // the member's click still counts.
  async function request() {
    if (!mediaDevices) return;
    requestVersion += 1;
    const version = requestVersion;
    report({ outcome: null, status: "requesting" });
    try {
      accept(await mediaDevices.getDisplayMedia(SCREEN_CONSTRAINTS), version);
    } catch (error) {
      if (version !== requestVersion) return;
      report({ outcome: outcomeOfCaptureError(error), status: "idle" });
    }
  }

  function end(reason: ScreenShareEndReason) {
    requestVersion += 1;
    if (!live) {
      if (status === "requesting") report(IDLE_SCREEN_SHARE);
      return;
    }

    const { onEnded, track } = live;
    live = undefined;
    track.removeEventListener("ended", onEnded);
    track.stop();
    report({ outcome: reason, status: "idle" });
    onLocalChange({
      endReason: reason,
      previousTrack: track,
      publicationId: SCREEN_PUBLICATION_ID,
      source: "screen",
      type: "removed",
    });
  }

  return {
    end,
    toggle() {
      if (status === "sharing") end("stopped");
      else if (status === "idle") void request();
    },
  };
}
