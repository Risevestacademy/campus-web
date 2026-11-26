import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { expect, screen } from "storybook/test";

import { Dialog, DialogContent } from "@/shared/ui/dialog";

import { NewRoomLinkForm } from "./new-room-link-dialog";

const meta = {
  title: "Features/Calendar/NewRoomLinkForm",
  component: NewRoomLinkForm,
  decorators: [
    (Story) => (
      <QueryClientProvider client={new QueryClient()}>
        <Dialog open>
          <DialogContent>
            <Story />
          </DialogContent>
        </Dialog>
      </QueryClientProvider>
    ),
  ],
} satisfies Meta<typeof NewRoomLinkForm>;

export default meta;

type Story = StoryObj<typeof meta>;

// A professor or mentor makes a link for the space they stand in, and is told
// that it does not make the event.
export const InTheirOwnSpace: Story = {
  args: {
    cohortId: "c-1",
    space: { kind: "own", space: { id: "s-1", name: "Library" } },
  },
  play: async () => {
    await expect(
      await screen.findByText(
        "Your link will open Library. To make one for another space, walk into it first.",
      ),
    ).toBeVisible();
    await expect(
      screen.getByRole("button", { name: "Make link" }),
    ).toBeDisabled();
  },
};
