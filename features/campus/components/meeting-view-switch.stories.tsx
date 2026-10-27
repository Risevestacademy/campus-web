import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, within } from "storybook/test";

import { MediaSessionProvider } from "../services/media-session/media-session-provider";
import { createMediaSessionStore } from "../services/media-session/media-session-store";
import type {
  MeetingParticipant,
  ProximityMeeting,
} from "../types/active-campus.types";
import { CampusViewProvider } from "./campus-view-provider";
import {
  DEFAULT_MEETING_TILE_MOTION,
  type MeetingTileMotionConfig,
} from "./meeting-tiles";
import { MeetingViewControls } from "./meeting-view-switch";

const previewMediaSessionStore = createMediaSessionStore({
  mediaDevices: null,
});

const everyoneNearby: readonly MeetingParticipant[] = [
  { id: "participant-a", initials: "AL", name: "Ada Lovelace", tone: "cobalt" },
  { id: "participant-j", initials: "JB", name: "James Baldwin", tone: "lemon" },
  {
    id: "participant-g",
    initials: "GH",
    name: "Grace Hopper",
    tone: "turquoise",
  },
  { id: "participant-l", initials: "LW", name: "Lin Wei", tone: "lemon" },
  { id: "participant-m", initials: "MA", name: "Maya Angelou", tone: "cobalt" },
  {
    id: "participant-t",
    initials: "TM",
    name: "Toni Morrison",
    tone: "turquoise",
  },
];

interface MeetingViewMotionLabProps {
  durationMs: number;
  bounce: number;
  nearbyCount: number;
}

function MeetingViewMotionLab({
  durationMs,
  bounce,
  nearbyCount,
}: MeetingViewMotionLabProps) {
  const motionConfig: MeetingTileMotionConfig = {
    durationMs,
    bounce,
  };
  const meeting: ProximityMeeting = {
    encounter: 1,
    localParticipantId: "participant-a",
    participants: everyoneNearby.slice(0, nearbyCount + 1),
  };

  return (
    <div className="bg-background relative h-dvh overflow-hidden">
      <div className="relative z-1 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-start gap-1.5 p-2.5">
        <span aria-hidden="true" />
        <MeetingViewControls meeting={meeting} motionConfig={motionConfig} />
      </div>

      <div className="bg-cobalt-500/10 absolute inset-1.5 grid place-items-center rounded-xl">
        <p className="text-foreground-secondary text-sm">
          Campus surface preview
        </p>
      </div>
    </div>
  );
}

const meta = {
  title: "Features/Campus/MeetingView/Motion",
  component: MeetingViewMotionLab,
  decorators: [
    (Story) => (
      <MediaSessionProvider store={previewMediaSessionStore}>
        <CampusViewProvider>
          <Story />
        </CampusViewProvider>
      </MediaSessionProvider>
    ),
  ],
  tags: ["!autodocs"],
  args: {
    durationMs: DEFAULT_MEETING_TILE_MOTION.durationMs,
    bounce: DEFAULT_MEETING_TILE_MOTION.bounce,
    nearbyCount: 1,
  },
  argTypes: {
    nearbyCount: {
      control: {
        type: "range",
        min: 1,
        max: everyoneNearby.length - 1,
        step: 1,
      },
    },
    durationMs: {
      control: {
        type: "range",
        min: 180,
        max: 800,
        step: 10,
      },
    },
    bounce: {
      control: {
        type: "range",
        min: 0,
        max: 0.3,
        step: 0.01,
      },
    },
  },
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta<typeof MeetingViewMotionLab>;

export default meta;

type Story = StoryObj<typeof meta>;

async function verifyTileExpansion(canvasElement: HTMLElement) {
  const canvas = within(canvasElement);
  const participantTile = canvas.getByRole("button", {
    name: "Show expanded meeting view for Ada Lovelace",
  });

  await userEvent.click(participantTile);

  await expect(
    canvas.getByRole("switch", { name: "Use grid view" }),
  ).toHaveAttribute("aria-checked", "true");
  await expect(
    canvas.getByRole("button", { name: "Focus Ada Lovelace" }),
  ).toBeInTheDocument();
}

async function verifyFocusedTileLayout(canvasElement: HTMLElement) {
  const canvas = within(canvasElement);

  await userEvent.click(
    canvas.getByRole("switch", {
      name: "Use grid view",
    }),
  );

  const participantJ = canvas.getByRole("button", {
    name: "Focus James Baldwin",
  });

  await userEvent.click(participantJ);

  await expect(
    canvas.getByRole("button", { name: "Restore equal meeting view" }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    canvas.getByRole("button", { name: "Focus Ada Lovelace" }),
  ).toHaveAttribute("aria-pressed", "false");
}

export const Expanded: Story = {
  play: async ({ canvasElement }) => {
    await verifyTileExpansion(canvasElement);
  },
};

export const Focused: Story = {
  play: async ({ canvasElement }) => {
    await verifyFocusedTileLayout(canvasElement);
  },
};

export const Crowd: Story = {
  args: { nearbyCount: 5 },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.click(
      canvas.getByRole("button", { name: "Show all 6 participants" }),
    );

    await expect(
      canvas.getByRole("switch", { name: "Use grid view" }),
    ).toHaveAttribute("aria-checked", "true");
    await expect(
      canvas.getByRole("button", { name: "Focus Toni Morrison" }),
    ).toBeInTheDocument();
  },
};
