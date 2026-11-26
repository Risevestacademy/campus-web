import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";

import { Button } from "@/shared/ui/button";
import { toast, Toaster } from "@/shared/ui/toast";

import { spaceFullToast } from "./space-full-toast";

// The map shows it with `priority: "high"`, which only changes how it is
// announced: Base UI hides the toast from assistive tech until the toast area
// has focus, and its focus guards trip axe's aria-hidden-focus rule. The story
// leaves it out, as the entry toast stories do.
function SpaceFullTrigger({ title }: Readonly<{ title: string }>) {
  return (
    <Toaster>
      <Button
        variant="outline"
        onClick={() => toast.add(spaceFullToast(title))}
      >
        Step in
      </Button>
    </Toaster>
  );
}

const meta = {
  title: "Features/CampusWorld/SpaceFullToast",
  component: SpaceFullTrigger,
  args: { title: "Library is full" },
} satisfies Meta<typeof SpaceFullTrigger>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Full: Story = {
  play: async ({ canvasElement }) => {
    await userEvent.click(
      within(canvasElement).getByRole("button", { name: "Step in" }),
    );
    const document = canvasElement.ownerDocument;
    await waitFor(() =>
      expect(document.querySelector("[data-slot=toast]")).not.toBeNull(),
    );

    await expect(
      within(
        document.querySelector<HTMLElement>("[data-slot=toast]")!,
      ).getByText("Library is full"),
    ).toBeVisible();
  },
};
