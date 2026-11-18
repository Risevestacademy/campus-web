import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, within } from "storybook/test";

import { Checkbox } from "./checkbox";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "./field";

const meta = {
  title: "Primitives/Checkbox",
  component: Checkbox,
} satisfies Meta<typeof Checkbox>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Gallery: Story = {
  render: () => (
    <FieldSet className="w-80">
      <FieldLegend>Notifications</FieldLegend>
      <FieldDescription>
        Choose which Campus updates you want to receive.
      </FieldDescription>
      <FieldGroup>
        <Field orientation="horizontal">
          <Checkbox id="product-updates" />
          <FieldLabel htmlFor="product-updates">Product updates</FieldLabel>
        </Field>
        <Field orientation="horizontal">
          <Checkbox id="security-alerts" defaultChecked />
          <FieldLabel htmlFor="security-alerts">Security alerts</FieldLabel>
        </Field>
        <Field orientation="horizontal">
          <Checkbox id="selected-groups" indeterminate />
          <FieldLabel htmlFor="selected-groups">
            Selected campus groups
          </FieldLabel>
        </Field>
        <Field data-disabled orientation="horizontal">
          <Checkbox id="archived-updates" disabled />
          <FieldLabel htmlFor="archived-updates">Archived updates</FieldLabel>
        </Field>
        <Field data-invalid orientation="horizontal">
          <Checkbox id="terms" aria-describedby="terms-error" aria-invalid />
          <FieldContent>
            <FieldLabel htmlFor="terms">Accept the community terms</FieldLabel>
            <FieldError id="terms-error">
              You must accept the terms to continue.
            </FieldError>
          </FieldContent>
        </Field>
      </FieldGroup>
    </FieldSet>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const checkbox = canvas.getByRole("checkbox", {
      name: "Product updates",
    });
    const indeterminateCheckbox = canvas.getByRole("checkbox", {
      name: "Selected campus groups",
    });

    await userEvent.click(checkbox);
    await expect(checkbox).toHaveAttribute("aria-checked", "true");
    await expect(indeterminateCheckbox).toHaveAttribute(
      "aria-checked",
      "mixed",
    );
    await expect(
      indeterminateCheckbox.querySelector('[data-icon="indeterminate"]'),
    ).toBeVisible();
  },
};
