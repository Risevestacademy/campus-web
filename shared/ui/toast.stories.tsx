import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";

import { Button } from "./button";
import { createToastManager, Toaster } from "./toast";

const storyToastManager = createToastManager();

const meta = {
  title: "Primitives/Toast",
  component: Toaster,
  args: { toastManager: storyToastManager },
} satisfies Meta<typeof Toaster>;

export default meta;

type Story = StoryObj<typeof meta>;

export const ErrorFeedback: Story = {
  render: (toasterProps) => (
    <Toaster {...toasterProps}>
      <Button
        variant="outline"
        onClick={() =>
          storyToastManager.add({
            description:
              "Allow camera access in your browser settings, then try again.",
            id: "story-camera",
            priority: "high",
            title: "Camera is blocked",
            type: "error",
          })
        }
      >
        Turn on camera
      </Button>
    </Toaster>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const document = canvasElement.ownerDocument;
    const page = within(document.body);
    const trigger = canvas.getByRole("button", { name: "Turn on camera" });

    await userEvent.click(trigger);
    await userEvent.click(trigger);

    const announcement = await page.findByRole("alert");
    await expect(announcement).toHaveTextContent("Camera is blocked");

    const toasts = [
      ...document.querySelectorAll<HTMLElement>("[data-slot=toast]"),
    ];
    await expect(toasts).toHaveLength(1);
    const [toastElement] = toasts;
    if (!toastElement) throw new Error("Expected one visible toast.");

    await expect(
      within(toastElement).getByText("Camera is blocked"),
    ).toBeVisible();

    await userEvent.keyboard("{F6}");
    await userEvent.click(
      await within(toastElement).findByRole("button", { name: "Close toast" }),
    );
    await waitFor(() =>
      expect(document.querySelector("[data-slot=toast]")).toBeNull(),
    );
  },
};
