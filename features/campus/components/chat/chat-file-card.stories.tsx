import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";

import { markFileGone } from "../../store/chat-panel-store";
import { ChatFileCard, FILE_GONE_NOTICE } from "./chat-file-card";

const meta = {
  title: "Features/Campus/Chat/ChatFileCard",
  component: ChatFileCard,
  decorators: [
    (Story) => (
      <div className="bg-shell-panel border-shell-line w-72 rounded-xl border p-3">
        <Story />
      </div>
    ),
  ],
  args: {
    attachment: {
      mediaId: "story-pdf",
      fileName: "onboarding-flow.pdf",
      contentType: "application/pdf",
      sizeBytes: 1_234_567,
    },
  },
} satisfies Meta<typeof ChatFileCard>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Pdf: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByText("1.2 MB")).toBeVisible();
    await expect(
      canvas.getByRole("button", { name: "Open onboarding-flow.pdf" }),
    ).toBeEnabled();
  },
};

export const Image: Story = {
  args: {
    attachment: {
      mediaId: "story-image",
      fileName: "sign-in-frame.png",
      contentType: "image/png",
      sizeBytes: 48_213,
    },
  },
};

export const Spreadsheet: Story = {
  args: {
    attachment: {
      mediaId: "story-sheet",
      fileName: "cohort-schedule.xlsx",
      contentType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      sizeBytes: 96_000,
    },
  },
};

export const WithoutAName: Story = {
  args: {
    attachment: {
      mediaId: "story-nameless",
      fileName: null,
      contentType: "application/x-unknown",
      sizeBytes: 512,
    },
  },
};

export const LongName: Story = {
  args: {
    attachment: {
      mediaId: "story-long",
      fileName:
        "a-very-long-file-name-that-keeps-going-and-going-for-the-whole-meeting-notes.docx",
      contentType: "application/msword",
      sizeBytes: 2_500_000,
    },
  },
};

export const WithWhoSentIt: Story = {
  args: { detail: "Grace Hopper · 03:01 PM" },
};

export const NoLongerAvailable: Story = {
  args: {
    attachment: {
      mediaId: "story-gone",
      fileName: "last-week.pdf",
      contentType: "application/pdf",
      sizeBytes: 10_000,
    },
  },
  decorators: [
    (Story) => {
      markFileGone("story-gone");
      return <Story />;
    },
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByText(FILE_GONE_NOTICE)).toBeVisible();
    await expect(canvas.queryByRole("button", { name: /^Open/ })).toBeNull();
  },
};
