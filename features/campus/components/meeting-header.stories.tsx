import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import type { Meeting } from "../types/active-campus.types";
import { CampusViewProvider } from "./campus-view-provider";
import { MeetingHeader } from "./meeting-header";

const nearbyMeeting: Meeting = {
  encounter: 1,
  hearing: "proximity",
  title: "Nearby",
  localParticipantId: "participant-a",
  participants: [
    {
      id: "participant-a",
      initials: "AL",
      name: "Ada Lovelace",
      tone: "cobalt",
    },
    {
      id: "participant-g",
      initials: "GH",
      name: "Grace Hopper",
      tone: "turquoise",
    },
  ],
};

const meta = {
  title: "Features/Campus/MeetingHeader",
  component: MeetingHeader,
  decorators: [
    (Story) => (
      <CampusViewProvider>
        <div className="bg-background p-2.5">
          <Story />
        </div>
      </CampusViewProvider>
    ),
  ],
  args: { meeting: nearbyMeeting },
} satisfies Meta<typeof MeetingHeader>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Nearby: Story = {};

export const Room: Story = {
  args: {
    meeting: {
      ...nearbyMeeting,
      hearing: "room",
      title: "Library",
      participants: [
        ...nearbyMeeting.participants,
        { id: "participant-l", initials: "LW", name: "Lin Wei", tone: "lemon" },
        {
          id: "participant-m",
          initials: "MA",
          name: "Maya Angelou",
          tone: "cobalt",
        },
      ],
    },
  },
};

export const Alone: Story = {
  args: { meeting: null },
};
