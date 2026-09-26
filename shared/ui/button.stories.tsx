import { ArrowRightIcon } from "@phosphor-icons/react/dist/ssr/ArrowRight";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";

import { Button, buttonSizeNames, buttonVariantNames } from "./button";

const textButtonSizes = buttonSizeNames.filter(
  (size) => !size.startsWith("icon"),
);
const iconButtonSizes = buttonSizeNames.filter((size) =>
  size.startsWith("icon"),
);

const meta = {
  title: "Primitives/Button",
  component: Button,
  args: {
    children: "Continue",
    size: "default",
    variant: "default",
  },
  argTypes: {
    size: {
      control: "select",
      options: buttonSizeNames,
    },
    variant: {
      control: "select",
      options: buttonVariantNames,
    },
  },
} satisfies Meta<typeof Button>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Gallery: Story = {
  parameters: {
    a11y: {
      test: "todo",
    },
  },
  render: () => (
    <div className="flex flex-col items-start gap-6">
      <section className="flex flex-col gap-3">
        <p className="text-sm font-medium">Variants</p>
        <div className="flex flex-wrap items-center gap-3">
          {buttonVariantNames.map((variant) => (
            <Button key={variant} variant={variant}>
              {variant}
            </Button>
          ))}
          <Button disabled>Disabled</Button>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <p className="text-sm font-medium">Text sizes</p>
        <div className="flex flex-wrap items-center gap-3">
          {textButtonSizes.map((size) => (
            <Button key={size} size={size}>
              {size}
            </Button>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <p className="text-sm font-medium">Icon composition and sizes</p>
        <div className="flex flex-wrap items-end gap-3">
          <Button>
            Continue
            <ArrowRightIcon aria-hidden data-icon="inline-end" />
          </Button>
          {iconButtonSizes.map((size) => (
            <div key={size} className="flex flex-col items-center gap-2">
              <Button size={size} aria-label={`Continue, ${size} icon button`}>
                <ArrowRightIcon aria-hidden />
              </Button>
              <span className="text-muted-foreground text-xs">{size}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(
      canvas.getByRole("button", { name: "Continue" }),
    ).toBeVisible();

    for (const size of iconButtonSizes) {
      await expect(
        canvas.getByRole("button", {
          name: `Continue, ${size} icon button`,
        }),
      ).toBeVisible();
    }
  },
};
