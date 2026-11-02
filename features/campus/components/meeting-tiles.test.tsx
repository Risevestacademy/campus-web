import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type {
  MeetingMediaTransport,
  VideoLayer,
} from "../services/media-session/contracts";
import { MediaSessionProvider } from "../services/media-session/media-session-provider";
import { createMediaSessionStore } from "../services/media-session/media-session-store";
import { meetingTiles } from "../services/meeting/meeting";
import {
  createTestMediaStream,
  createTestMediaTrack,
} from "../testing/media-session-test-utils";
import type {
  Meeting,
  MeetingParticipant,
  MeetingTileLayout,
} from "../types/active-campus.types";
import { MeetingTiles } from "./meeting-tiles";

function participant(id: string, name: string): MeetingParticipant {
  return { id, initials: name.slice(0, 2), name, tone: "cobalt" };
}

const ADA = participant("ada", "Ada");
const PARTICIPANTS = [
  ADA,
  participant("grace", "Grace"),
  participant("lin", "Lin"),
  participant("maya", "Maya"),
  participant("alan", "Alan"),
  participant("joan", "Joan"),
];

const MEETING: Meeting = {
  encounter: 1,
  hearing: "room",
  localParticipantId: ADA.id,
  participants: PARTICIPANTS,
  title: "Library",
};

const camerasOnly = (cameras: readonly (readonly [string, VideoLayer])[]) => ({
  camera: new Map(cameras),
  screen: new Map(),
});

function renderTiles(
  layout: MeetingTileLayout,
  sharing: readonly string[] = [],
) {
  const setVideoDemand = vi.fn<MeetingMediaTransport["setVideoDemand"]>();
  const store = createMediaSessionStore({
    mediaDevices: null,
    transport: {
      connect: () => () => undefined,
      handleLocalPublicationChange() {},
      retry() {},
      setVideoDemand,
    },
  });
  const onTileActivate = vi.fn();
  const tiles = (nextLayout: MeetingTileLayout) => (
    <MediaSessionProvider store={store}>
      <MeetingTiles
        layout={nextLayout}
        localParticipantId={ADA.id}
        onShowAll={() => undefined}
        onTileActivate={onTileActivate}
        shouldAnimate={false}
        tiles={meetingTiles(MEETING, new Set(sharing))}
      />
    </MediaSessionProvider>
  );
  const view = render(tiles(layout));

  return {
    lastDemand: async () => {
      await new Promise<void>(queueMicrotask);
      return setVideoDemand.mock.lastCall?.[0];
    },
    onTileActivate,
    showLayout: (nextLayout: MeetingTileLayout) =>
      view.rerender(tiles(nextLayout)),
    store,
    unmount: view.unmount,
  };
}

describe("MeetingTiles video demand", () => {
  it("asks for the cameras of the remote tiles the strip shows, as thumbnails", async () => {
    const tiles = renderTiles({ mode: "compact" });

    expect(await tiles.lastDemand()).toEqual(
      camerasOnly([
        ["grace", "low"],
        ["lin", "low"],
        ["maya", "low"],
      ]),
    );
  });

  it("asks for the focused camera in full and every other as a thumbnail", async () => {
    const tiles = renderTiles({ mode: "compact" });

    tiles.showLayout({ mode: "expanded", focusedTileId: "grace" });

    expect(await tiles.lastDemand()).toEqual(
      camerasOnly([
        ["grace", "high"],
        ["lin", "low"],
        ["maya", "low"],
        ["alan", "low"],
        ["joan", "low"],
      ]),
    );
  });

  it("lets every camera go once the tiles close", async () => {
    const tiles = renderTiles({ mode: "compact" });
    await tiles.lastDemand();

    tiles.unmount();

    expect(await tiles.lastDemand()).toEqual(camerasOnly([]));
  });

  it("asks for a share in the strip as a thumbnail, and it takes a place in the cap", async () => {
    const tiles = renderTiles({ mode: "compact" }, ["maya"]);

    expect(await tiles.lastDemand()).toEqual({
      camera: new Map([
        ["grace", "low"],
        ["lin", "low"],
      ]),
      screen: new Map([["maya", "low"]]),
    });
  });

  it("asks for a focused share in full, and for its owner's camera as a thumbnail", async () => {
    const tiles = renderTiles(
      { mode: "expanded", focusedTileId: "screen:grace" },
      ["grace"],
    );

    const demand = await tiles.lastDemand();

    expect(demand?.screen).toEqual(new Map([["grace", "high"]]));
    expect(demand?.camera.get("grace")).toBe("low");
  });
});

describe("MeetingTiles shares", () => {
  it("offers the share to focus without changing what is focused", () => {
    const tiles = renderTiles({ mode: "expanded", focusedTileId: null }, [
      "grace",
    ]);

    fireEvent.click(
      screen.getByRole("button", { name: "Focus Grace's screen" }),
    );

    expect(tiles.onTileActivate).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ id: "screen:grace" }),
      false,
    );
    expect(screen.getByRole("button", { name: "Focus Grace" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("keeps counting people, not tiles, behind the more button", () => {
    renderTiles({ mode: "compact" }, ["grace"]);

    expect(
      screen.getByRole("button", {
        name: `Show all ${PARTICIPANTS.length} participants`,
      }),
    ).toBeInTheDocument();
  });

  it("shows the whole of a shared screen, never cropped", () => {
    const track = createTestMediaTrack("video", "grace-screen");
    const tiles = renderTiles({ mode: "compact" }, ["grace"]);

    act(() => {
      tiles.store.setState({
        remotePublications: {
          grace: {
            screen: {
              enabled: true,
              origin: "remote",
              participantId: "grace",
              publicationId: "grace-screen",
              source: "screen",
              stream: createTestMediaStream([track]),
              track,
            },
          },
        },
      });
    });

    expect(screen.getByLabelText("Grace's screen")).toHaveClass(
      "object-contain",
    );
  });
});
