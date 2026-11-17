import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, within } from "storybook/test";

import { setChatDraft } from "../../store/chat-panel-store";
import { ChatComposer } from "./chat-composer";

const meta = {
  title: "Features/Campus/Chat/ChatComposer",
  component: ChatComposer,
  decorators: [
    (Story) => {
      setChatDraft("");
      return (
        <div className="bg-shell-panel border-shell-line w-78 rounded-xl border">
          <Story />
        </div>
      );
    },
  ],
  args: {
    cohortId: "story-cohort",
    placeholder: "Message Mentor pod 1",
    synced: true,
  },
} satisfies Meta<typeof ChatComposer>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Empty: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(
      canvas.getByRole("button", { name: "Send message" }),
    ).toBeDisabled();
    await expect(
      canvas.getByRole("button", { name: "Attach a file" }),
    ).toHaveAttribute("aria-disabled", "true");
  },
};

export const Typing: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.type(
      canvas.getByRole("textbox"),
      "Can everyone see page 3?",
    );

    await expect(
      canvas.getByRole("button", { name: "Send message" }),
    ).toBeEnabled();
  },
};

export const NearTheLimit: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.click(canvas.getByRole("textbox"));
    await userEvent.paste("x".repeat(440));

    await expect(canvas.getByText("440/500")).toBeVisible();
    await expect(
      canvas.getByRole("button", { name: "Send message" }),
    ).toBeEnabled();
  },
};

export const OverTheLimit: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.click(canvas.getByRole("textbox"));
    await userEvent.paste("x".repeat(520));

    await expect(canvas.getByText("520/500")).toBeVisible();
    await expect(
      canvas.getByRole("button", { name: "Send message" }),
    ).toBeDisabled();
    await expect(canvas.getByRole("textbox")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
  },
};

export const Reconnecting: Story = {
  args: { synced: false },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByText("Reconnecting…")).toBeVisible();
    await expect(
      canvas.getByRole("button", { name: "Send message" }),
    ).toBeDisabled();
  },
};
