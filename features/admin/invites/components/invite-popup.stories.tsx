import { UserPlusIcon } from "@phosphor-icons/react/dist/ssr/UserPlus";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";

import { Button } from "@/shared/ui/button";

import {
  InvitePopup,
  InvitePopupCancel,
  POPUP_ACTION_CLASS_NAME,
} from "./invite-popup";

const meta = {
  title: "Features/Admin/Invites/InvitePopup",
  component: InvitePopup,
  args: {
    open: true,
    onOpenChange: fn(),
    triggerIcon: <UserPlusIcon aria-hidden />,
    triggerLabel: "Invite people",
    title: "Invite people",
    description: "They'll get an email with a one-time link.",
    footer: (
      <>
        <InvitePopupCancel />
        <Button type="submit" size="sm" className={POPUP_ACTION_CLASS_NAME}>
          Send invite
        </Button>
      </>
    ),
    children: <p>The popup&apos;s body.</p>,
  },
} satisfies Meta<typeof InvitePopup>;

export default meta;

type Story = StoryObj<typeof meta>;

// A popup reads as a dialog named by its title, with its own Close and Cancel.
export const Open: Story = {
  play: async ({ canvasElement }) => {
    const page = within(canvasElement.ownerDocument.body);
    const dialog = await page.findByRole("dialog", { name: "Invite people" });

    await waitFor(() => expect(dialog).toBeVisible());
    await expect(
      within(dialog).getByRole("button", { name: "Close" }),
    ).toBeVisible();
    await expect(
      within(dialog).getByRole("button", { name: "Cancel" }),
    ).toBeVisible();
  },
};

export const AsForm: Story = {
  args: { onSubmit: fn((event) => event.preventDefault()) },
  play: async ({ args, canvasElement }) => {
    const page = within(canvasElement.ownerDocument.body);
    const dialog = await page.findByRole("dialog", { name: "Invite people" });

    await userEvent.click(
      within(dialog).getByRole("button", { name: "Send invite" }),
    );

    await expect(args.onSubmit).toHaveBeenCalledOnce();
  },
};
