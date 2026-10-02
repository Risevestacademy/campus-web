import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, within } from "storybook/test";

import { MediaSessionProvider } from "../services/media-session/media-session-provider";
import { createMediaSessionStore } from "../services/media-session/media-session-store";
import {
  DEFAULT_MEETING_TILE_MOTION,
  type MeetingTileMotionConfig,
} from "./meeting-tiles";
import { MeetingViewControls } from "./meeting-view-switch";

const previewMediaSessionStore = createMediaSessionStore({
  mediaDevices: null,
});

const meetingParticipants = [
  { id: "participant-a", initials: "A", name: "Ada Lovelace" },
  { id: "participant-j", initials: "J", name: "James Baldwin" },
] as const;

interface MeetingViewMotionLabProps {
  durationMs: number;
  bounce: number;
}

function MeetingViewMotionLab({
  durationMs,
  bounce,
}: MeetingViewMotionLabProps) {
  const motionConfig: MeetingTileMotionConfig = {
    durationMs,
    bounce,
  };

  return (
    <div className="bg-background relative h-dvh overflow-hidden">
      <div className="relative z-1 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-start gap-1.5 p-2.5">
        <span aria-hidden="true" />
        <MeetingViewControls
          localParticipantId="participant-a"
          motionConfig={motionConfig}
          participants={meetingParticipants}
        />
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
        <Story />
      </MediaSessionProvider>
    ),
  ],
  tags: ["!autodocs"],
  args: {
    durationMs: DEFAULT_MEETING_TILE_MOTION.durationMs,
    bounce: DEFAULT_MEETING_TILE_MOTION.bounce,
  },
  argTypes: {
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
