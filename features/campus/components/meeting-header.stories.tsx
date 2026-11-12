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
      initial: "A",
      name: "Ada Lovelace",
      avatarClassName: "bg-cobalt-300 text-cobalt-950",
    },
    {
      id: "participant-g",
      initial: "G",
      name: "Grace Hopper",
      avatarClassName: "bg-turquoise-300 text-turquoise-950",
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
        {
          id: "participant-l",
          initial: "L",
          name: "Lin Wei",
          avatarClassName: "bg-lemon-300 text-lemon-950",
        },
        {
          id: "participant-m",
          initial: "M",
          name: "Maya Angelou",
          avatarClassName: "bg-cobalt-300 text-cobalt-950",
        },
      ],
    },
  },
};

export const Alone: Story = {
  args: { meeting: null },
};
