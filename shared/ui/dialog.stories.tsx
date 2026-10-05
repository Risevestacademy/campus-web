import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";

import { Button } from "./button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./dialog";

const meta = {
  title: "Primitives/Dialog",
  component: Dialog,
} satisfies Meta<typeof Dialog>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Basic: Story = {
  render: () => (
    <Dialog>
      <DialogTrigger
        render={<Button variant="outline">Open announcement</Button>}
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Campus opens Monday</DialogTitle>
          <DialogDescription>
            Your cohort starts in the main hall at 9:00.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>
            Not now
          </DialogClose>
          <Button>Add to calendar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      canvas.getByRole("button", { name: "Open announcement" }),
    );

    const page = within(canvasElement.ownerDocument.body);
    const dialog = await page.findByRole("dialog", {
      name: "Campus opens Monday",
    });
    await waitFor(() => expect(dialog).toBeVisible());
    await waitFor(() =>
      expect(dialog).toContainElement(
        canvasElement.ownerDocument.activeElement as HTMLElement,
      ),
    );

    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(page.queryByRole("dialog")).toBeNull());
  },
};
