import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Toaster } from "@/shared/ui/toast";
import {
  ADA,
  applyFrame,
  callFrame,
  clearPresence,
  GRACE,
  seedPresence,
  spaceChangedFrame,
} from "@/tests/fixtures/nearby-presence";

import type {
  CallAudioStatus,
  MeetingMediaTransportCallbacks,
} from "../services/media-session/contracts";
import { MediaSessionProvider } from "../services/media-session/media-session-provider";
import { createMediaSessionStore } from "../services/media-session/media-session-store";
import {
  createTestMediaStream,
  createTestMediaTrack,
} from "../testing/media-session-test-utils";
import { PresenceDock } from "./presence-dock";
import { CallMediaFeedback } from "./presence-session";
import { ScreenShareControl } from "./screen-share-control";
import { ScreenShareStatus } from "./screen-share-status";

const COHORT = "c-share";

function setUp({
  callStatus = "connected",
  supported = true,
}: Readonly<{ callStatus?: CallAudioStatus; supported?: boolean }> = {}) {
  const track = createTestMediaTrack("video", "screen-1");
  const getDisplayMedia = vi.fn(async () => createTestMediaStream([track]));
  const mediaDevices = Object.assign(new EventTarget(), {
    enumerateDevices: vi.fn().mockResolvedValue([]),
    ...(supported ? { getDisplayMedia } : {}),
  }) as unknown as MediaDevices;
  vi.stubGlobal("navigator", { mediaDevices });
  let callbacks: MeetingMediaTransportCallbacks | undefined;
  const store = createMediaSessionStore({
    mediaDevices,
    transport: {
      connect(next) {
        callbacks = next;
        next.onStatusChange(callStatus);
        return () => undefined;
      },
      handleLocalPublicationChange() {},
      retry() {},
      setVideoDemand() {},
    },
  });
  store.getState().connect();

  return { callbacks: () => callbacks!, getDisplayMedia, store, track };
}

type Setup = ReturnType<typeof setUp>;

function renderControl({ store }: Setup) {
  return render(
    <MediaSessionProvider store={store}>
      <ScreenShareControl cohortId={COHORT} />
    </MediaSessionProvider>,
  );
}

function shareButton() {
  return screen.getByRole("button", { name: "Share screen" });
}

async function share({ store }: Setup) {
  await act(async () => {
    store.getState().toggleScreenShare();
  });
}

const settle = () =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve));
  });

function meetInLibrary() {
  seedPresence(COHORT);
  applyFrame(COHORT, spaceChangedFrame(ADA, "library"));
  applyFrame(COHORT, spaceChangedFrame(GRACE, "library"));
  applyFrame(COHORT, callFrame("room"));
}

afterEach(() => {
  clearPresence(COHORT);
  vi.unstubAllGlobals();
});

describe("ScreenShareControl", () => {
  it.each([
    ["while the member is alone", [], true],
    ["in a browser that cannot share a screen", [GRACE], false],
  ] as const)("does not exist %s", (_case, near, supported) => {
    seedPresence(COHORT, ...near);
    renderControl(setUp({ supported }));

    expect(
      screen.queryByRole("button", { name: "Share screen" }),
    ).not.toBeInTheDocument();
  });

  it.each([
    ["proximity", () => seedPresence(COHORT, GRACE)],
    ["room", meetInLibrary],
  ] as const)("appears when a %s meeting starts", (_hearing, meet) => {
    meet();
    renderControl(setUp());

    expect(shareButton()).toBeEnabled();
  });

  it("goes away when the meeting ends", () => {
    seedPresence(COHORT, GRACE);
    renderControl(setUp());

    act(() => applyFrame(COHORT, { type: "nearby", userIds: [] }));

    expect(
      screen.queryByRole("button", { name: "Share screen" }),
    ).not.toBeInTheDocument();
  });

  it.each(["idle", "connecting", "unavailable"] as const)(
    "waits for the call while it is %s",
    (callStatus) => {
      seedPresence(COHORT, GRACE);
      renderControl(setUp({ callStatus }));

      expect(shareButton()).toBeDisabled();
    },
  );

  it("shares on click, and stops on the next click", async () => {
    seedPresence(COHORT, GRACE);
    const context = setUp();
    renderControl(context);

    await act(async () => {
      fireEvent.click(shareButton());
    });

    expect(context.getDisplayMedia).toHaveBeenCalledOnce();
    const stop = screen.getByRole("button", { name: "Stop sharing screen" });
    expect(stop).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(stop);

    expect(context.track.stop).toHaveBeenCalledOnce();
    expect(shareButton()).toHaveAttribute("aria-pressed", "false");
  });
});

describe("ScreenShareStatus", () => {
  function renderStatus({ store }: Setup) {
    return render(
      <MediaSessionProvider store={store}>
        <ScreenShareStatus cohortId={COHORT} />
      </MediaSessionProvider>,
    );
  }

  it("shows nothing until the member is sharing", () => {
    seedPresence(COHORT, GRACE);
    renderStatus(setUp());

    expect(screen.queryByText("Sharing your screen")).not.toBeInTheDocument();
  });

  it.each([
    ["near", () => seedPresence(COHORT, GRACE), "Anyone near you can see it"],
    ["in a room", meetInLibrary, "Anyone in this space can see it"],
  ] as const)(
    "states who could see the share when meeting people %s",
    async (_case, meet, reach) => {
      meet();
      const context = setUp();
      renderStatus(context);

      await share(context);

      expect(screen.getByText("Sharing your screen")).toBeInTheDocument();
      expect(screen.getByText(reach)).toBeInTheDocument();
    },
  );

  it("offers Stop on the pages the Presence Dock covers", async () => {
    seedPresence(COHORT, GRACE);
    const context = setUp();
    render(
      <MediaSessionProvider store={context.store}>
        <PresenceDock cohortId={COHORT} userName="Ada Lovelace" />
      </MediaSessionProvider>,
    );
    await share(context);
    const dock = screen.getByRole("complementary", { name: "Presence dock" });

    fireEvent.click(within(dock).getByRole("button", { name: "Stop sharing" }));

    expect(context.track.stop).toHaveBeenCalledOnce();
    expect(within(dock).queryByText("Sharing your screen")).toBeNull();
  });
});

describe("screen share feedback", () => {
  function renderFeedback({ store }: Setup) {
    render(<Toaster />);
    render(
      <MediaSessionProvider store={store}>
        <CallMediaFeedback />
      </MediaSessionProvider>,
    );
  }

  it.each([
    ["meeting_ended", "Screen sharing stopped", "Your meeting ended."],
    [
      "room_closed",
      "Screen sharing stopped",
      "Your call changed. Share again to continue.",
    ],
    [
      "publish_failed",
      "Your screen didn't reach the call",
      "Share again to retry.",
    ],
  ] as const)("tells the member after %s", async (reason, title, detail) => {
    const context = setUp();
    renderFeedback(context);
    await share(context);

    act(() => context.callbacks().onScreenShareEnded(reason));

    const notification = await screen.findByRole("alert");
    expect(notification).toHaveTextContent(title);
    expect(notification).toHaveTextContent(detail);
  });

  it("tells the member a capture could not start", async () => {
    const context = setUp();
    context.getDisplayMedia.mockRejectedValueOnce(
      new DOMException("busy", "NotReadableError"),
    );
    renderFeedback(context);

    await share(context);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Couldn't share your screen",
    );
  });

  it("says nothing when the member cancels the picker", async () => {
    const context = setUp();
    context.getDisplayMedia.mockRejectedValueOnce(
      new DOMException("dismissed", "NotAllowedError"),
    );
    renderFeedback(context);

    await share(context);
    await settle();

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it.each<[string, (context: Setup) => void]>([
    ["in the app", ({ store }) => store.getState().toggleScreenShare()],
    [
      "from the browser's own bar",
      ({ track }) => track.dispatchEvent(new Event("ended")),
    ],
  ])("says nothing when the member stops %s", async (_case, stop) => {
    const context = setUp();
    renderFeedback(context);
    await share(context);

    act(() => stop(context));
    await settle();

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("clears a warning when the member shares again", async () => {
    const context = setUp();
    renderFeedback(context);
    await share(context);
    act(() => context.callbacks().onScreenShareEnded("publish_failed"));
    await screen.findByRole("alert");

    await share(context);

    await waitFor(() =>
      expect(screen.queryByRole("alert")).not.toBeInTheDocument(),
    );
  });
});
