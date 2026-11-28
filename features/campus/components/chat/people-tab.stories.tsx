import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";

import { MediaSessionProvider } from "../../services/media-session/media-session-provider";
import { createMediaSessionStore } from "../../services/media-session/media-session-store";
import type { MeetingParticipant } from "../../types/active-campus.types";
import { PeopleTab } from "./people-tab";

const ADA: MeetingParticipant = {
  id: "ada",
  initial: "A",
  name: "Ada Lovelace",
  avatarClassName: "bg-cobalt-300 text-cobalt-950",
};
const GRACE: MeetingParticipant = {
  id: "grace",
  initial: "G",
  name: "Grace Hopper",
  avatarClassName: "bg-turquoise-300 text-turquoise-950",
};
const LIN: MeetingParticipant = {
  id: "lin",
  initial: "L",
  name: "Lin Wei",
  avatarClassName: "bg-lemon-300 text-lemon-950",
};

const meta = {
  title: "Features/Campus/Chat/PeopleTab",
  component: PeopleTab,
  decorators: [
    (Story) => (
      <MediaSessionProvider
        store={createMediaSessionStore({ mediaDevices: null })}
      >
        <div className="bg-shell-panel border-shell-line flex h-80 w-78 flex-col rounded-xl border">
          <Story />
        </div>
      </MediaSessionProvider>
    ),
  ],
  args: { localId: "ada", people: [ADA, GRACE, LIN] },
} satisfies Meta<typeof PeopleTab>;

export default meta;

type Story = StoryObj<typeof meta>;

export const InTheMeeting: Story = {
  play: async ({ canvasElement }) => {
    const rows = within(canvasElement).getAllByRole("listitem");

    await expect(rows).toHaveLength(3);
    await expect(rows[0]).toHaveTextContent("You");
  },
};

export const Alone: Story = {
  args: { people: [ADA] },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByText("Nobody else is here."),
    ).toBeVisible();
  },
};
