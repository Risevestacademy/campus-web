import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, within } from "storybook/test";

import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSeparator,
  FieldSet,
} from "./field";
import { Input } from "./input";
import { Textarea } from "./textarea";

const meta = {
  title: "Primitives/Field",
  component: Field,
} satisfies Meta<typeof Field>;

export default meta;

type Story = StoryObj<typeof meta>;

function CampusProfileForm({ className }: { className: string }) {
  return (
    <form className={className}>
      <FieldSet>
        <FieldLegend>Campus profile</FieldLegend>
        <FieldDescription>
          Information shown to other members of your campus.
        </FieldDescription>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="display-name">Display name</FieldLabel>
            <Input id="display-name" placeholder="Enter your display name" />
            <FieldDescription>
              Use the name people know you by.
            </FieldDescription>
          </Field>
          <Field data-invalid>
            <FieldLabel htmlFor="email-address">Email address</FieldLabel>
            <Input
              id="email-address"
              type="email"
              defaultValue="invalid-email"
              aria-describedby="email-error"
              aria-invalid
            />
            <FieldError id="email-error">
              Enter a valid email address.
            </FieldError>
          </Field>
          <FieldSeparator>Optional</FieldSeparator>
          <Field orientation="responsive">
            <FieldContent>
              <FieldLabel htmlFor="biography">About you</FieldLabel>
              <FieldDescription>
                Share a short introduction with your campus.
              </FieldDescription>
            </FieldContent>
            <Textarea id="biography" />
          </Field>
        </FieldGroup>
      </FieldSet>
    </form>
  );
}

async function exerciseProfileForm(
  canvasElement: HTMLElement,
  expectedDirection: "column" | "row",
) {
  const canvas = within(canvasElement);
  const displayName = canvas.getByLabelText("Display name");
  const biography = canvas.getByLabelText("About you");
  const responsiveField = biography.closest<HTMLElement>('[data-slot="field"]');

  await expect(responsiveField).not.toBeNull();

  if (!responsiveField) {
    throw new Error("Responsive biography field was not rendered.");
  }

  await userEvent.type(displayName, "Ada Lovelace");
  await expect(displayName).toHaveValue("Ada Lovelace");
  await expect(canvas.getByRole("alert")).toHaveTextContent(
    "Enter a valid email address.",
  );
  await expect(window.getComputedStyle(responsiveField).flexDirection).toBe(
    expectedDirection,
  );
}

export const Compact: Story = {
  render: () => <CampusProfileForm className="w-full max-w-sm" />,
  play: async ({ canvasElement }) => {
    await exerciseProfileForm(canvasElement, "column");
  },
};

export const Wide: Story = {
  render: () => <CampusProfileForm className="w-full max-w-2xl" />,
  play: async ({ canvasElement }) => {
    await exerciseProfileForm(canvasElement, "row");
  },
};
