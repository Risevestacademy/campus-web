import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import type { PublishedEntryMap, SpaceSettings } from "../types/maps.types";
// The staging entry map as readPublishedEntryMap returned it on 2026-11-27.
import stagingMap from "./map-fixture.json";
import { MapWorkspace } from "./map-workspace";

const stagingEntryMap = stagingMap as PublishedEntryMap;
const MAP_ID = "22222222-2222-4222-8222-222222222222";

function row(key: string, overrides: Partial<SpaceSettings> = {}) {
  return {
    id: `id-${key}`,
    mapId: MAP_ID,
    key,
    name: key,
    kind: "classroom" as const,
    access: "normal" as const,
    audioMode: "boundary" as const,
    capacity: null,
    isMapDefault: false,
    ...overrides,
  } satisfies SpaceSettings;
}

const spaces: SpaceSettings[] = [
  row("admin", { name: "Admin", kind: "help_desk" }),
  row("town_hall", { name: "Town Hall", kind: "town_hall" }),
  row("library", { name: "Library", kind: "open" }),
  row("courtyard_space_2", { name: "Pod A", kind: "mentor_pod" }),
  row("notice_room", { name: "Notice Room", kind: "notice_board" }),
  row("room_space_1", { name: "Room 1" }),
  row("room_space_2", { name: "Room 2", kind: "meeting_room" }),
  row("room_space_3", { kind: null }),
  row("courtyard_space_1", { kind: null }),
];

const meta = {
  title: "Features/Admin/Maps/MapWorkspace",
  component: MapWorkspace,
  parameters: { layout: "fullscreen", nextjs: { appDirectory: true } },
  decorators: [
    (Story) => (
      <QueryClientProvider client={new QueryClient()}>
        <div className="p-10">
          <Story />
        </div>
      </QueryClientProvider>
    ),
  ],
  args: {
    map: stagingEntryMap,
    entry: {
      id: MAP_ID,
      key: "campus",
      name: "Campus",
      syncedVersion: stagingEntryMap.version,
      publishedVersion: "older",
    },
    spaces,
    cohortId: "33333333-3333-4333-8333-333333333333",
    grantOptions: {
      tracks: [
        { id: "cohort-track-1", name: "Frontend" },
        { id: "cohort-track-2", name: "Backend" },
      ],
      groups: [{ id: "group-1", name: "The Ravens" }],
    },
  },
} satisfies Meta<typeof MapWorkspace>;

export default meta;

type Story = StoryObj<typeof meta>;

export const StagingMap: Story = {};
