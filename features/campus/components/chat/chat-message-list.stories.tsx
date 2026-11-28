import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";

import type { ChatMessage } from "../../services/chat/chat-messages";
import { ChatMessageList } from "./chat-message-list";

function message(
  id: string,
  who: "grace" | "lin" | "you",
  text: string,
  at: string,
): ChatMessage {
  const people = {
    grace: {
      name: "Grace Hopper",
      initial: "G",
      tone: "bg-turquoise-300 text-turquoise-950",
    },
    lin: { name: "Lin Wei", initial: "L", tone: "bg-lemon-300 text-lemon-950" },
    you: { name: "You", initial: "A", tone: "bg-cobalt-300 text-cobalt-950" },
  } as const;
  const person = people[who];
  return {
    id,
    userId: who,
    name: person.name,
    initial: person.initial,
    avatarClassName: person.tone,
    text,
    at,
    isOwn: who === "you",
  };
}

const ENTERED = Date.parse("2026-11-17T15:00:00.000Z");

const meta = {
  title: "Features/Campus/Chat/ChatMessageList",
  component: ChatMessageList,
  decorators: [
    (Story) => (
      <div className="bg-shell-panel border-shell-line flex h-96 w-78 flex-col rounded-xl border">
        <Story />
      </div>
    ),
  ],
  args: { enteredAt: ENTERED, messages: [] },
} satisfies Meta<typeof ChatMessageList>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Empty: Story = {
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByText("No messages yet. Say hello."),
    ).toBeVisible();
  },
};

export const Conversation: Story = {
  args: {
    messages: [
      message(
        "1",
        "grace",
        "Sharing my screen in a sec, the onboarding flow is on page 3.",
        "2026-11-17T15:01:10.000Z",
      ),
      message(
        "2",
        "grace",
        "Say when you can see it.",
        "2026-11-17T15:01:40.000Z",
      ),
      message(
        "3",
        "lin",
        "Love the new illustrations \u{1F440}",
        "2026-11-17T15:02:10.000Z",
      ),
      message(
        "4",
        "you",
        "Nice. Let’s start from the sign-in screen.",
        "2026-11-17T15:03:10.000Z",
      ),
    ],
  },
  play: async ({ canvasElement }) => {
    const log = within(canvasElement).getByRole("log", { name: "Messages" });

    await expect(within(log).getAllByText("Grace Hopper")).toHaveLength(1);
    await expect(within(log).getByText("You")).toBeVisible();
  },
};

export const LongText: Story = {
  args: {
    messages: [
      message(
        "1",
        "grace",
        "https://example.com/a/very/long/address/that/has/no/spaces/in/it/at/all/and/keeps/going",
        "2026-11-17T15:01:10.000Z",
      ),
      message(
        "2",
        "lin",
        "A line with\nseveral\nbreaks in it.",
        "2026-11-17T15:02:10.000Z",
      ),
    ],
  },
};

export const WithoutAJoinTime: Story = {
  args: { enteredAt: null },
};
