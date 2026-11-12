import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";

import { Button } from "@/shared/ui/button";
import { Toaster } from "@/shared/ui/toast";

import {
  ENTRY_TOAST_ID,
  type EntryToast,
} from "../services/space-locks/ask-to-enter";
import { showEntryToast } from "./entry-toast";

// The map shows these with `priority: "high"`, which only changes how they
// are announced: Base UI reads them out from a live region and hides the
// toast from assistive tech until the toast area has focus, and its focus
// guards trip axe's aria-hidden-focus rule. The stories leave it out so the
// toast stays on screen for the accessibility check.
type Refusal = Omit<EntryToast, "id" | "onClose" | "priority">;

// The refusal a member sees on stepping into a space world keeps them out
// of, shown through the app's own toast manager as the map shows it.
function EntryToastTrigger(refusal: Refusal) {
  return (
    <Toaster>
      <Button
        variant="outline"
        onClick={() =>
          showEntryToast({ ...refusal, id: ENTRY_TOAST_ID, onClose: fn() })
        }
      >
        Step in
      </Button>
    </Toaster>
  );
}

const ask = { label: "Ask to enter", onClick: fn() };

const meta = {
  title: "Features/CampusWorld/EntryToast",
  component: EntryToastTrigger,
  args: {
    look: "private",
    title: "Admin office is private",
    description: "Someone inside can let you in",
    timeout: 0,
    actions: [ask],
  },
} satisfies Meta<typeof EntryToastTrigger>;

export default meta;

type Story = StoryObj<typeof meta>;

async function stepIn(canvasElement: HTMLElement) {
  await userEvent.click(
    within(canvasElement).getByRole("button", { name: "Step in" }),
  );
  const document = canvasElement.ownerDocument;
  await waitFor(() =>
    expect(document.querySelector("[data-slot=toast]")).not.toBeNull(),
  );
  return within(document.querySelector<HTMLElement>("[data-slot=toast]")!);
}

function askButton(toast: ReturnType<typeof within>) {
  return toast.queryByRole("button", { name: "Ask to enter" });
}

export const PrivateRoom: Story = {
  play: async ({ canvasElement }) => {
    const toast = await stepIn(canvasElement);

    await expect(toast.getByText("Admin office is private")).toBeVisible();
    await expect(
      toast.getByText("Someone inside can let you in"),
    ).toBeVisible();
    await expect(askButton(toast)).toBeVisible();
  },
};

export const LockedRoom: Story = {
  args: { look: "locked", title: "Room 1 is locked" },
  play: async ({ canvasElement }) => {
    const toast = await stepIn(canvasElement);

    await expect(toast.getByText("Room 1 is locked")).toBeVisible();
    await expect(askButton(toast)).toBeVisible();
  },
};

export const PrivateRoomWithoutAsking: Story = {
  args: {
    look: "private",
    title: "Admin office is private",
    description: undefined,
    timeout: undefined,
    actions: undefined,
  },
  play: async ({ canvasElement }) => {
    const toast = await stepIn(canvasElement);

    await expect(toast.getByText("Admin office is private")).toBeVisible();
    await expect(askButton(toast)).not.toBeInTheDocument();
  },
};

export const UnknownSpace: Story = {
  args: {
    look: "refused",
    title: "You can't enter that space",
    description: undefined,
    timeout: undefined,
    actions: undefined,
  },
  play: async ({ canvasElement }) => {
    const toast = await stepIn(canvasElement);

    await expect(toast.getByText("You can't enter that space")).toBeVisible();
  },
};
