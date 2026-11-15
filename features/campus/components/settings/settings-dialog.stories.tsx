import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, within } from "storybook/test";

import { MediaSessionProvider } from "../../services/media-session/media-session-provider";
import { createMediaSessionStore } from "../../services/media-session/media-session-store";
import { SettingsDialog } from "./settings-dialog";

function previewDevice(
  deviceId: string,
  kind: MediaDeviceKind,
  label: string,
): MediaDeviceInfo {
  const device = { deviceId, groupId: `${deviceId}-group`, kind, label };
  return { ...device, toJSON: () => device } as MediaDeviceInfo;
}

const previewDevices = [
  previewDevice("default", "videoinput", "FaceTime HD Camera"),
  previewDevice("usb-camera", "videoinput", "USB Webcam"),
  previewDevice("default", "audioinput", "MacBook Pro Microphone"),
  previewDevice("headset", "audioinput", "USB Headset"),
  previewDevice("default", "audiooutput", "MacBook Pro Speakers"),
];

// Lists devices without ever opening the camera or microphone.
const previewMediaDevices = Object.assign(new EventTarget(), {
  enumerateDevices: () => Promise.resolve(previewDevices),
  getUserMedia: () =>
    Promise.reject(new DOMException("Preview only", "NotAllowedError")),
}) as unknown as MediaDevices;

const meta = {
  title: "Features/Campus/SettingsDialog",
  component: SettingsDialog,
  decorators: [
    (Story) => (
      <MediaSessionProvider
        store={createMediaSessionStore({ mediaDevices: previewMediaDevices })}
      >
        <Story />
      </MediaSessionProvider>
    ),
  ],
  tags: ["!autodocs"],
  args: {
    open: true,
    onOpenChange: fn(),
    LogOutAction: ({ children }) =>
      children({ logOut: fn(), isPending: false }),
  },
} satisfies Meta<typeof SettingsDialog>;

export default meta;

type Story = StoryObj<typeof meta>;

export const AudioAndVideo: Story = {
  play: async ({ canvasElement }) => {
    const page = within(canvasElement.ownerDocument.body);

    await expect(
      await page.findByRole("combobox", { name: "Camera" }),
    ).toBeVisible();
  },
};

export const Appearance: Story = {
  play: async ({ canvasElement }) => {
    const page = within(canvasElement.ownerDocument.body);

    await userEvent.click(await page.findByRole("tab", { name: "Appearance" }));

    await expect(page.getByRole("radiogroup", { name: "Theme" })).toBeVisible();
  },
};
