import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { http } from "msw";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";

import { toast, Toaster } from "@/shared/ui/toast";
import { TEST_ORIGIN } from "@/tests/fixtures/mock-api";
import { withQueryClient } from "@/tests/fixtures/query-client";

import type {
  EntryMapRecord,
  PublishedEntryMap,
  SpaceSettings,
} from "../types/maps.types";
import { MapWorkspace } from "./map-workspace";

const mockApi = await vi.hoisted(async () => {
  const { startMockApi } = await import("@/tests/fixtures/mock-api");
  return startMockApi();
});
const sideEffects = vi.hoisted(() => [] as string[]);
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: () => sideEffects.push("refresh") }),
}));

const SYNC_URL = `${TEST_ORIGIN}/api/v1/maps/sync`;
const COHORT_ID = "33333333-3333-4333-8333-333333333333";
const grantOptions = {
  tracks: [{ id: "cohort-track-1", name: "Frontend" }],
  groups: [],
};
const ENTRY_ID = "22222222-2222-4222-8222-222222222222";

function rect(x: number) {
  return { shape: "rect" as const, x, y: 1, width: 4, height: 4 };
}

const map: PublishedEntryMap = {
  mapKey: "campus",
  version: "version-2",
  widthTiles: 20,
  heightTiles: 8,
  spaces: [
    { key: "town_hall", name: "town_hall", bounds: rect(1) },
    { key: "room_space_1", name: "room_space_1", bounds: rect(6) },
    { key: "library", name: "library", bounds: rect(11) },
  ],
  desks: [{ key: "desk_a1", x: 2, y: 6 }],
  walls: [],
};

function row(key: string, overrides: Partial<SpaceSettings> = {}) {
  return {
    id: `id-${key}`,
    mapId: ENTRY_ID,
    key,
    name: key,
    kind: "town_hall" as const,
    access: "normal" as const,
    audioMode: "boundary" as const,
    capacity: null,
    isMapDefault: false,
    ...overrides,
  };
}

const spaces: SpaceSettings[] = [
  row("town_hall", { name: "Town Hall" }),
  row("room_space_1", { kind: null }),
];

const preview = {
  dryRun: true,
  changed: true,
  maps: [
    {
      outcome: "updated",
      key: "campus",
      version: "version-2",
      isEntry: true,
      spaces: {
        added: [{ key: "library", name: "Library", kind: "classroom" }],
        restored: [],
        retired: ["old-lab"],
        needsKind: ["room_space_1"],
      },
      desks: { added: ["desk_a1"], restored: [], retired: [] },
    },
  ],
};

const synced: EntryMapRecord = {
  id: ENTRY_ID,
  key: "campus",
  name: "Campus",
  syncedVersion: "version-2",
  publishedVersion: "version-1",
};

function renderWorkspace(entry: EntryMapRecord | null = synced) {
  render(
    <>
      {withQueryClient(
        <MapWorkspace
          map={map}
          entry={entry}
          spaces={spaces}
          cohortId={COHORT_ID}
          grantOptions={grantOptions}
        />,
      )}
      <Toaster />
    </>,
  );
}

afterEach(() => {
  mockApi.reset();
  sideEffects.length = 0;
  toast.close();
});
afterAll(() => mockApi.close());

describe("MapWorkspace", () => {
  it("draws each space with its state and points at the one needing a kind", () => {
    renderWorkspace();

    expect(
      screen.getByRole("button", { name: "Town Hall, Town hall" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "room_space_1, needs a kind" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "library, not in the campus yet" }),
    ).toBeInTheDocument();
    expect(screen.getByText("1 space needs a kind.")).toBeInTheDocument();
  });

  it("previews, then syncs what the preview listed", async () => {
    const dryRuns: string[] = [];
    mockApi.server.use(
      http.post(SYNC_URL, ({ request }) => {
        const dryRun = new URL(request.url).searchParams.get("dryRun") ?? "";
        dryRuns.push(dryRun);
        return Response.json({ ...preview, dryRun: dryRun === "true" });
      }),
    );
    renderWorkspace();

    fireEvent.click(screen.getByRole("button", { name: "Preview sync" }));

    expect(
      await screen.findByText(/syncing would make 3 changes here/),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: "library, not in the campus yet, added by this sync",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("old-lab")).toBeInTheDocument();
    expect(sideEffects).toEqual([]);

    fireEvent.click(screen.getByRole("button", { name: "Sync 3 changes" }));

    expect(await screen.findByText("Maps synced")).toBeInTheDocument();
    expect(dryRuns).toEqual(["true", "false"]);
    expect(sideEffects).toEqual(["refresh"]);
  });

  it("lists what is wrong with the published maps", async () => {
    mockApi.server.use(
      http.post(SYNC_URL, () =>
        Response.json(
          {
            error: {
              code: "CONFLICT",
              message: "Rejected",
              details: { problems: ["campus: no spawn point"] },
            },
          },
          { status: 409 },
        ),
      ),
    );
    renderWorkspace();

    fireEvent.click(screen.getByRole("button", { name: "Preview sync" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("The published maps can't be used");
    expect(
      within(alert).getByText("campus: no spawn point"),
    ).toBeInTheDocument();
  });

  it("sets up a space from its sheet, sending only what changed", async () => {
    const bodies: unknown[] = [];
    mockApi.server.use(
      http.patch(
        `${TEST_ORIGIN}/api/v1/spaces/id-room_space_1`,
        async ({ request }) => {
          bodies.push(await request.json());
          return Response.json({});
        },
      ),
    );
    renderWorkspace();

    fireEvent.click(screen.getByRole("button", { name: "Show me" }));
    const sheet = await screen.findByRole("dialog");
    fireEvent.change(within(sheet).getByLabelText("Room type"), {
      target: { value: "meeting_room" },
    });
    fireEvent.click(within(sheet).getByRole("button", { name: "Save space" }));

    expect(await screen.findByText("Space saved")).toBeInTheDocument();
    expect(bodies).toEqual([{ kind: "meeting_room" }]);
    expect(sideEffects).toEqual(["refresh"]);
  });

  it("locks a space the campus does not have yet", async () => {
    renderWorkspace();

    fireEvent.click(
      screen.getByRole("button", { name: "library, not in the campus yet" }),
    );

    const sheet = await screen.findByRole("dialog");
    expect(sheet).toHaveTextContent("Sync first.");
    expect(
      within(sheet).queryByRole("button", { name: "Save space" }),
    ).not.toBeInTheDocument();
  });

  it("publishes the entry map by the id its spaces carry", async () => {
    const published: string[] = [];
    mockApi.server.use(
      http.post(`${TEST_ORIGIN}/api/v1/maps/:id/publish`, ({ params }) => {
        published.push(String(params.id));
        return Response.json({
          publishedAt: "2026-11-23T12:00:00.000Z",
          id: ENTRY_ID,
          key: "campus",
        });
      }),
    );
    renderWorkspace();

    fireEvent.click(screen.getByRole("button", { name: "Publish campus" }));

    expect(await screen.findByText("campus is live")).toBeInTheDocument();
    expect(published).toEqual([ENTRY_ID]);
  });

  it("says the latest sync is not live yet", () => {
    renderWorkspace();

    expect(screen.getByText("Synced, not published")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Publish campus" }),
    ).toBeEnabled();
  });

  it("holds Publish back while Sanity is ahead of the campus", () => {
    renderWorkspace({ ...synced, syncedVersion: "version-1" });

    expect(screen.getByText("Sanity has a newer map")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Publish campus" }),
    ).toBeDisabled();
    expect(screen.getByText(/the campus is behind it/)).toBeInTheDocument();
  });

  it("asks for one sync before any version is recorded", () => {
    renderWorkspace({ ...synced, syncedVersion: null, publishedVersion: null });

    expect(screen.getByText("Version unknown, sync once")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Publish campus" }),
    ).toBeDisabled();
  });

  it("offers a sync when only the version moved", async () => {
    mockApi.server.use(
      http.post(SYNC_URL, () =>
        Response.json({
          dryRun: true,
          changed: false,
          maps: [
            {
              ...preview.maps[0],
              outcome: "unchanged",
              spaces: { added: [], restored: [], retired: [], needsKind: [] },
              desks: { added: [], restored: [], retired: [] },
            },
          ],
        }),
      ),
    );
    renderWorkspace({ ...synced, syncedVersion: "version-1" });

    fireEvent.click(screen.getByRole("button", { name: "Preview sync" }));

    expect(
      await screen.findByText(/hasn't recorded this version yet/),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sync" })).toBeInTheDocument();
  });

  it("offers the two audio modes, each saying what it does", async () => {
    renderWorkspace();

    fireEvent.click(screen.getByRole("button", { name: "Show me" }));
    const sheet = await screen.findByRole("dialog");

    expect(
      within(sheet).getByRole("radio", { name: /^Proximity audio/ }),
    ).toHaveAccessibleName(
      "Proximity audio: You hear people near you, and voices fade with distance.",
    );
    expect(
      within(sheet).getByRole("radio", { name: /^Boundary audio/ }),
    ).toBeChecked();
    expect(within(sheet).queryByLabelText(/Capacity/)).toBeNull();
  });

  it("lists who may enter a designated space, and adds and removes them", async () => {
    const grantsUrl = `${TEST_ORIGIN}/api/v1/spaces/id-room_space_1/memberships`;
    const grants = [
      {
        id: "grant-1",
        spaceId: "id-room_space_1",
        subject: { type: "user", userId: "u-1", displayName: "Ada L." },
        grantedBy: null,
        validFrom: "2026-11-01T09:00:00.000Z",
        validTo: null,
        live: true,
      },
    ];
    const writes: string[] = [];
    mockApi.server.use(
      http.get(grantsUrl, () => Response.json(grants)),
      http.post(grantsUrl, async ({ request }) => {
        writes.push(`add ${JSON.stringify(await request.json())}`);
        return Response.json(grants[0], { status: 201 });
      }),
      http.delete(`${grantsUrl}/:grantId`, ({ params }) => {
        writes.push(`end ${String(params.grantId)}`);
        return new Response(null, { status: 204 });
      }),
    );
    renderWorkspace();

    fireEvent.click(screen.getByRole("button", { name: "Show me" }));
    const sheet = await screen.findByRole("dialog");
    fireEvent.change(within(sheet).getByLabelText("Who can enter"), {
      target: { value: "designated" },
    });

    expect(await within(sheet).findByText("Ada L.")).toBeInTheDocument();
    expect(sheet).toHaveTextContent("The list applies once you save the space");

    fireEvent.change(within(sheet).getByLabelText("Add"), {
      target: { value: "cohort_track" },
    });
    fireEvent.click(within(sheet).getByRole("button", { name: "Add" }));
    expect(await screen.findByText("Added to the list")).toBeInTheDocument();

    fireEvent.click(
      within(sheet).getByRole("button", {
        name: "Remove Ada L. from the list",
      }),
    );
    expect(
      await screen.findByText("Removed from the list"),
    ).toBeInTheDocument();
    expect(writes).toEqual([
      'add {"cohortTrackId":"cohort-track-1"}',
      "end grant-1",
    ]);
    expect(sideEffects).toEqual([]);
  });

  it("opens a space's settings in a sheet, and closes it", async () => {
    renderWorkspace();

    fireEvent.click(
      screen.getByRole("button", { name: "Town Hall, Town hall" }),
    );
    const sheet = await screen.findByRole("dialog", { name: "Space settings" });
    expect(within(sheet).getByLabelText("Name")).toHaveValue("Town Hall");

    fireEvent.click(within(sheet).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });
});
