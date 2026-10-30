import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";

import { Button } from "./button";
import { Dialog, DialogContent, DialogTitle } from "./dialog";
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

const tryAgain = fn();

export const WithAction: Story = {
  render: (toasterProps) => (
    <Toaster {...toasterProps}>
      <Button
        variant="outline"
        onClick={() =>
          storyToastManager.add({
            actionProps: { children: "Try again", onClick: tryAgain },
            description:
              "You can still move around. Try again to hear people nearby.",
            id: "story-call-audio",
            timeout: 0,
            title: "Audio couldn't connect",
            type: "warning",
          })
        }
      >
        Join the call
      </Button>
    </Toaster>
  ),
  play: async ({ canvasElement }) => {
    const document = canvasElement.ownerDocument;
    const page = within(document.body);

    await userEvent.click(
      await page.findByRole("button", { name: "Join the call" }),
    );

    const description = await page.findByText(
      "You can still move around. Try again to hear people nearby.",
    );
    const action = await page.findByRole("button", { name: "Try again" });
    await waitFor(() => expect(action).toBeVisible());
    await expect(action.getBoundingClientRect().top).toBeGreaterThanOrEqual(
      description.getBoundingClientRect().bottom,
    );

    await userEvent.click(action);
    await expect(tryAgain).toHaveBeenCalledOnce();
  },
};

export const AboveDialog: Story = {
  render: (toasterProps) => (
    <Toaster {...toasterProps}>
      <Dialog defaultOpen>
        <DialogContent showCloseButton={false}>
          <DialogTitle>Create a cohort</DialogTitle>
          <Button
            onClick={() =>
              storyToastManager.add({
                id: "story-over-dialog",
                title: "Cohort created",
                type: "success",
              })
            }
          >
            Save
          </Button>
        </DialogContent>
      </Dialog>
    </Toaster>
  ),
  play: async ({ canvasElement }) => {
    const document = canvasElement.ownerDocument;
    const page = within(document.body);

    await userEvent.click(await page.findByRole("button", { name: "Save" }));

    const toastElement = (await page.findByText("Cohort created")).closest(
      "[data-slot=toast]",
    );
    if (!toastElement) throw new Error("Expected the toast to render.");
    await waitFor(() => expect(toastElement).toBeVisible());

    // Whatever paints at the toast's centre must be the toast, not the backdrop.
    await waitFor(() => {
      const { left, top, width, height } = toastElement.getBoundingClientRect();
      const painted = document.elementFromPoint(
        left + width / 2,
        top + height / 2,
      );
      return expect(toastElement.contains(painted)).toBe(true);
    });
  },
};
