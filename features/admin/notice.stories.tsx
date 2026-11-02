import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import Link from "next/link";
import { expect, within } from "storybook/test";

import { Notice } from "./notice";
import { peopleHref } from "./people/people-href";

const meta = {
  title: "Features/Admin/Notice",
  component: Notice,
} satisfies Meta<typeof Notice>;

export default meta;

type Story = StoryObj<typeof meta>;

// A message about the page, announced to assistive technology as an alert.
export const Message: Story = {
  args: { children: "No one in this cohort matches that search." },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole("alert")).toHaveTextContent(
      "No one in this cohort matches that search.",
    );
  },
};

// The retry link a failed read adds stays reachable inside the alert.
export const WithRetryLink: Story = {
  args: {
    children: (
      <>
        We couldn&apos;t load people.{" "}
        <Link className="text-primary underline" href={peopleHref("c-1")}>
          Try again
        </Link>
      </>
    ),
  },
  play: async ({ canvasElement }) => {
    const alert = within(canvasElement).getByRole("alert");

    await expect(alert).toHaveTextContent("We couldn't load people.");
    await expect(
      within(alert).getByRole("link", { name: "Try again" }),
    ).toHaveAttribute("href", "/campus/c-1/people");
  },
};
