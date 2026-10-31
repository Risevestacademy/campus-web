import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";
import { expect, userEvent, within } from "storybook/test";

import { EmailTokenField } from "./email-token-field";

function Field({ initial, invalid }: { initial: string[]; invalid?: boolean }) {
  const [emails, setEmails] = useState(initial);
  return (
    <EmailTokenField emails={emails} onChange={setEmails} invalid={invalid} />
  );
}

const meta = {
  title: "Features/Admin/Invites/EmailTokenField",
  component: Field,
  args: { initial: [] },
} satisfies Meta<typeof Field>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Empty: Story = {
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole("textbox", { name: "Emails" }),
    ).toBeVisible();
  },
};

export const SeveralAddresses: Story = {
  args: {
    initial: [
      "amaka.obi@gmail.com",
      "kunle.badmus@gmail.com",
      "tobi.ade@gmail.com",
    ],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByRole("button", { name: "Remove tobi.ade@gmail.com" }),
    ).toBeVisible();
  },
};

// An address that looks incomplete is drawn in the error color.
export const IncompleteAddress: Story = {
  args: { initial: ["amaka.obi@gmail.com", "kemi.bello@gmail"], invalid: true },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole("button", {
        name: "Remove kemi.bello@gmail",
      }),
    ).toBeVisible();
  },
};

export const TypingAddresses: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(
      canvas.getByRole("textbox", { name: "Emails" }),
      "ada@campus.local, grace@campus.local ",
    );
    await expect(
      canvas.getByRole("button", { name: "Remove grace@campus.local" }),
    ).toBeVisible();
  },
};
