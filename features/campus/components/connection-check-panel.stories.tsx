import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, within } from "storybook/test";

import type { ConnectionCheckSteps } from "../hooks/use-connection-check";
import { ConnectionCheckPanel } from "./connection-check-panel";

const PENDING: ConnectionCheckSteps = {
  network: "pending",
  microphone: "pending",
  camera: "pending",
};

const meta = {
  title: "Features/Campus/ConnectionCheck",
  component: ConnectionCheckPanel,
  args: {
    isRunning: false,
    onStart: fn(),
    result: undefined,
    steps: PENDING,
  },
} satisfies Meta<typeof ConnectionCheckPanel>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Idle: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.click(
      canvas.getByRole("button", { name: "Test connection" }),
    );

    await expect(args.onStart).toHaveBeenCalledOnce();
    await expect(canvas.getByRole("status")).toBeEmptyDOMElement();
  },
};

export const Running: Story = {
  args: {
    isRunning: true,
    steps: { network: "passed", microphone: "running", camera: "pending" },
  },
};

export const Passed: Story = {
  args: {
    result: { kind: "passed" },
    steps: { network: "passed", microphone: "passed", camera: "skipped" },
  },
};

export const NetworkBlocked: Story = {
  args: {
    result: { kind: "step-failed", step: "network" },
    steps: { network: "failed", microphone: "pending", camera: "pending" },
  },
};

export const MicrophoneFailed: Story = {
  args: {
    result: { kind: "step-failed", step: "microphone" },
    steps: { network: "passed", microphone: "failed", camera: "pending" },
  },
};

export const CameraFailed: Story = {
  args: {
    result: { kind: "step-failed", step: "camera" },
    steps: { network: "passed", microphone: "passed", camera: "failed" },
  },
};

export const RateLimited: Story = {
  args: { result: { kind: "rate-limited", retryAfterSeconds: 42 } },
};

export const CouldNotRun: Story = {
  args: { result: { kind: "failed" } },
};

export const Unavailable: Story = {
  args: { result: { kind: "unavailable" } },
};
