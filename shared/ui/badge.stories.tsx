import { CheckIcon } from "@phosphor-icons/react/dist/ssr/Check";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { Badge } from "./badge";

const variants = [
  "default",
  "secondary",
  "destructive",
  "outline",
  "ghost",
  "link",
] as const;

const meta = {
  title: "Primitives/Badge",
  component: Badge,
} satisfies Meta<typeof Badge>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Gallery: Story = {
  parameters: {
    a11y: {
      test: "todo",
    },
  },
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      {variants.map((variant) => (
        <Badge key={variant} variant={variant}>
          {variant}
        </Badge>
      ))}
      <Badge>
        <CheckIcon aria-hidden data-icon="inline-start" />
        Verified
      </Badge>
    </div>
  ),
};
