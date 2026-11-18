import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { Button } from "./button";
import {
  ButtonGroup,
  ButtonGroupSeparator,
  ButtonGroupText,
} from "./button-group";

const meta = {
  title: "Primitives/ButtonGroup",
  component: ButtonGroup,
  args: {
    orientation: "horizontal",
  },
  argTypes: {
    orientation: {
      control: "inline-radio",
      options: ["horizontal", "vertical"],
    },
  },
} satisfies Meta<typeof ButtonGroup>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Horizontal: Story = {
  render: (arguments_) => (
    <ButtonGroup {...arguments_} aria-label="Text alignment">
      <Button variant="outline">Left</Button>
      <Button variant="outline">Center</Button>
      <Button variant="outline">Right</Button>
    </ButtonGroup>
  ),
};

export const Vertical: Story = {
  args: {
    orientation: "vertical",
  },
  render: (arguments_) => (
    <ButtonGroup {...arguments_} aria-label="Document actions">
      <Button variant="outline">Duplicate</Button>
      <Button variant="outline">Archive</Button>
      <Button variant="outline" disabled>
        Delete
      </Button>
    </ButtonGroup>
  ),
};

export const WithTextAndSeparator: Story = {
  render: (arguments_) => (
    <ButtonGroup {...arguments_} aria-label="Page navigation">
      <Button variant="outline">Previous</Button>
      <ButtonGroupSeparator />
      <ButtonGroupText>Page 2 of 8</ButtonGroupText>
      <ButtonGroupSeparator />
      <Button variant="outline">Next</Button>
    </ButtonGroup>
  ),
};
