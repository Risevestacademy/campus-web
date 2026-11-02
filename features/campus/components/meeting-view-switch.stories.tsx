import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { AnimatePresence } from "motion/react";
import { useState } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";

import { Button } from "@/shared/ui/button";

import { MediaSessionProvider } from "../services/media-session/media-session-provider";
import { createMediaSessionStore } from "../services/media-session/media-session-store";
import type { Meeting, MeetingParticipant } from "../types/active-campus.types";
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
  const [{ isNear, encounter }, setNearness] = useState({
    isNear: true,
    encounter: 1,
  });
  const motionConfig: MeetingTileMotionConfig = {
    durationMs,
    bounce,
  };
  const meeting: Meeting = {
    encounter,
    hearing: "proximity",
    title: "Nearby",
    localParticipantId: "participant-a",
    participants: everyoneNearby.slice(0, nearbyCount + 1),
  };

  // Mirrors presence: coming back near after nobody was starts a new encounter.
  function toggleNearness() {
    setNearness((current) => ({
      isNear: !current.isNear,
      encounter: current.isNear ? current.encounter : current.encounter + 1,
    }));
  }

  return (
    <div className="bg-background relative h-dvh overflow-hidden">
      <div className="relative z-1 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-start gap-1.5 p-2.5">
        <span aria-hidden="true" />
        <AnimatePresence>
          {isNear ? (
            <MeetingViewControls
              key="meeting-view"
              meeting={meeting}
              motionConfig={motionConfig}
            />
          ) : null}
        </AnimatePresence>
      </div>

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={toggleNearness}
        className="absolute right-4 bottom-4 z-30"
      >
        {isNear ? "Walk away" : "Come back"}
      </Button>

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

function nextFrame() {
  return new Promise((resolve) => requestAnimationFrame(resolve));
}

const SETTLE_DEADLINE_MS = 4_000;

// The a11y check runs as soon as play returns, and text measured mid-fade
// fails contrast. Motion runs opacity as Web Animations, so wait until none
// is left running; layout transforms run in JS and never change colour.
async function settleMotion(canvasElement: HTMLElement) {
  const deadline = performance.now() + SETTLE_DEADLINE_MS;
  for (;;) {
    await nextFrame();
    if (performance.now() > deadline) {
      throw new Error("Motion did not settle before the a11y check.");
    }
    const running = canvasElement
      .getAnimations({ subtree: true })
      .filter(({ playState }) => playState === "running");
    if (running.length === 0) return;
    await Promise.all(
      running.map((animation) => animation.finished.catch(() => undefined)),
    );
  }
}

const STABLE_FRAMES = 3;

function sameRect(left: DOMRect, right: DOMRect) {
  return (
    left.x === right.x &&
    left.y === right.y &&
    left.width === right.width &&
    left.height === right.height
  );
}

// Layout animations run in JS, so settleMotion cannot see them: wait until
// the element stops moving.
async function settledRect(element: Element): Promise<DOMRect> {
  const deadline = performance.now() + SETTLE_DEADLINE_MS;
  let previous = element.getBoundingClientRect();
  let stableFrames = 0;
  while (stableFrames < STABLE_FRAMES) {
    await nextFrame();
    if (performance.now() > deadline) {
      throw new Error("Layout did not settle.");
    }
    const current = element.getBoundingClientRect();
    stableFrames = sameRect(current, previous) ? stableFrames + 1 : 0;
    previous = current;
  }
  return previous;
}

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
    await settleMotion(canvasElement);
  },
};

export const Focused: Story = {
  play: async ({ canvasElement }) => {
    await verifyFocusedTileLayout(canvasElement);
    await settleMotion(canvasElement);
  },
};

// Nobody near while the grid is open: the grid collapses toward the strip as
// it fades, instead of fading out at full size.
export const LeavesWhileExpanded: Story = {
  // The spring runs on time and the check samples frames: under parallel test
  // load one frame can outlast the default spring and read as a snap.
  args: { durationMs: 1_600 },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const tiles = canvas.getByRole("region", {
      name: "Meeting participant tiles",
    });
    const compact = await settledRect(tiles);
    await verifyTileExpansion(canvasElement);
    await settledRect(tiles);

    await userEvent.click(canvas.getByRole("button", { name: "Walk away" }));
    await nextFrame();
    await nextFrame();
    const leaving = tiles.getBoundingClientRect();

    // A snap lands on the compact rect at once; a collapse is still wider.
    await expect(leaving.width).toBeGreaterThan(compact.width + 1);

    await settleMotion(canvasElement);

    await waitFor(() =>
      expect(
        canvas.queryByRole("switch", { name: "Use grid view" }),
      ).not.toBeInTheDocument(),
    );
    await expect(
      canvas.getByRole("button", { name: "Come back" }),
    ).toBeInTheDocument();
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
    await settleMotion(canvasElement);
  },
};
