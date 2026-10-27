import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { LogoLoader } from "./logo-loader";

const meta = {
  title: "Primitives/LogoLoader",
  component: LogoLoader,
} satisfies Meta<typeof LogoLoader>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const OnBrand: Story = {
  render: () => (
    <div className="bg-primary grid place-items-center p-10">
      <LogoLoader className="h-16 w-auto text-white" />
    </div>
  ),
};
