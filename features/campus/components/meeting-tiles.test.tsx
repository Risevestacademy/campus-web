import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { MeetingMediaTransport } from "../services/media-session/contracts";
import { MediaSessionProvider } from "../services/media-session/media-session-provider";
import { createMediaSessionStore } from "../services/media-session/media-session-store";
import type {
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

function renderTiles(layout: MeetingTileLayout) {
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
  const tiles = (nextLayout: MeetingTileLayout) => (
    <MediaSessionProvider store={store}>
      <MeetingTiles
        layout={nextLayout}
        localParticipantId={ADA.id}
        onShowAll={() => undefined}
        onTileActivate={() => undefined}
        participants={PARTICIPANTS}
        shouldAnimate={false}
      />
    </MediaSessionProvider>
  );
  const view = render(tiles(layout));

  return {
    lastDemand: async () => {
      await new Promise<void>(queueMicrotask);
      return setVideoDemand.mock.lastCall?.[0];
    },
    showLayout: (nextLayout: MeetingTileLayout) =>
      view.rerender(tiles(nextLayout)),
    unmount: view.unmount,
  };
}

describe("MeetingTiles video demand", () => {
  it("asks for the cameras of the remote tiles the strip shows, as thumbnails", async () => {
    const tiles = renderTiles({ mode: "compact" });

    expect(await tiles.lastDemand()).toEqual(
      new Map([
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
      new Map([
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

    expect(await tiles.lastDemand()).toEqual(new Map());
  });
});
