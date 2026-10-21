import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, within } from "storybook/test";

import { AnalyticsConsentNotice } from "./analytics-consent-banner";

const meta = {
  title: "Analytics/Consent Notice",
  component: AnalyticsConsentNotice,
  args: { onAccept: fn(), onReject: fn() },
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof AnalyticsConsentNotice>;

export default meta;

type Story = StoryObj<typeof meta>;

export const PendingChoice: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.click(canvas.getByRole("button", { name: "Reject" }));
    await userEvent.click(canvas.getByRole("button", { name: "Accept" }));

    await expect(args.onReject).toHaveBeenCalledOnce();
    await expect(args.onAccept).toHaveBeenCalledOnce();
  },
};
