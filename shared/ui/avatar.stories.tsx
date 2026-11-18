import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import {
  Avatar,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
} from "./avatar";

const meta = {
  title: "Primitives/Avatar",
  component: Avatar,
} satisfies Meta<typeof Avatar>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Gallery: Story = {
  parameters: {
    a11y: {
      test: "todo",
    },
  },
  render: () => (
    <div className="flex items-end gap-6">
      <Avatar size="sm">
        <AvatarFallback>SM</AvatarFallback>
      </Avatar>
      <Avatar>
        <AvatarFallback>AR</AvatarFallback>
      </Avatar>
      <Avatar size="lg">
        <AvatarFallback>LG</AvatarFallback>
      </Avatar>
      <AvatarGroup>
        <Avatar>
          <AvatarFallback>AR</AvatarFallback>
        </Avatar>
        <Avatar>
          <AvatarFallback>JM</AvatarFallback>
        </Avatar>
        <AvatarGroupCount>+2</AvatarGroupCount>
      </AvatarGroup>
    </div>
  ),
};
