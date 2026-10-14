import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { CatalogueCardLink } from "./catalogue-card-link";

const meta = {
  title: "Composites/CatalogueCardLink",
  component: CatalogueCardLink,
  args: {
    href: "/campus",
    title: "Cohort 1",
    description: "C1",
  },
} satisfies Meta<typeof CatalogueCardLink>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithoutDescription: Story = {
  args: {
    title: "Open cohort",
    description: undefined,
  },
};
