import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, within } from "storybook/test";

import { Field, FieldLabel, FieldLegend, FieldSet } from "./field";
import { RadioGroup, RadioGroupItem } from "./radio-group";

const meta = {
  title: "Primitives/RadioGroup",
  component: RadioGroup,
} satisfies Meta<typeof RadioGroup>;

export default meta;

type Story = StoryObj<typeof meta>;

const SEATING = [
  ["front", "Front row"],
  ["middle", "Middle"],
  ["back", "Back row"],
] as const;

export const Gallery: Story = {
  render: () => (
    <FieldSet className="w-80">
      <FieldLegend variant="label">Seating</FieldLegend>
      <RadioGroup name="seating" defaultValue="front">
        {SEATING.map(([value, label]) => (
          <Field key={value} orientation="horizontal">
            <RadioGroupItem id={`seating-${value}`} value={value} />
            <FieldLabel htmlFor={`seating-${value}`}>{label}</FieldLabel>
          </Field>
        ))}
        <Field data-disabled orientation="horizontal">
          <RadioGroupItem id="seating-stage" value="stage" disabled />
          <FieldLabel htmlFor="seating-stage">Stage</FieldLabel>
        </Field>
      </RadioGroup>
    </FieldSet>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const front = canvas.getByRole("radio", { name: "Front row" });
    const middle = canvas.getByRole("radio", { name: "Middle" });

    await expect(front).toHaveAttribute("aria-checked", "true");

    await userEvent.click(middle);
    await expect(middle).toHaveAttribute("aria-checked", "true");
    await expect(front).toHaveAttribute("aria-checked", "false");
  },
};
