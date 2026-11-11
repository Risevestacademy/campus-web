import { afterEach, describe, expect, it, vi } from "vitest";

import { createPresenceStore } from "@/core/presence";
import type { NotificationMessage } from "@/core/realtime";
import { toast } from "@/shared/ui/toast";
import { serverFrames } from "@/tests/fixtures/world-frames";

import {
  announceNotification,
  notificationNotice,
} from "./notification-feedback";

function presenceWith(spaces: Array<{ spaceKey: string; name: string }> = []) {
  const store = createPresenceStore();
  store.getState().apply({ ...serverFrames.snapshot, spaces });
  return store.getState();
}

function notification(
  overrides: Partial<NotificationMessage> = {},
): NotificationMessage {
  return {
    type: "notification",
    id: "n-1",
    kind: "entry_request_admitted",
    context: { cohortId: "c-1", spaceKey: "library" },
    ...overrides,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("notificationNotice", () => {
  it("names the space as world names it, and greets a yes as good news", () => {
    expect(
      notificationNotice(
        notification(),
        presenceWith([{ spaceKey: "library", name: "Library" }]),
      ),
    ).toEqual({ title: "You were let into Library.", type: "success" });
  });

  it("falls back to the space's key until it is named, and warns on a no", () => {
    expect(
      notificationNotice(
        notification({ kind: "entry_request_declined" }),
        presenceWith(),
      ),
    ).toEqual({
      title: "Your request to enter library was declined.",
      type: "warning",
    });
  });

  it.each([
    ["a posted notice", "notice_posted", "A new notice was posted."],
    ["a kind added later", "unknown", "You have a new notification."],
  ] as const)("keeps %s plain", (_, kind, title) => {
    expect(
      notificationNotice(notification({ kind, context: null }), presenceWith()),
    ).toEqual({ title, type: "info" });
  });
});

describe("announceNotification", () => {
  it("toasts once, keyed by the notification so a repeat replaces it", () => {
    const add = vi.spyOn(toast, "add");

    announceNotification(notification(), presenceWith());

    expect(add).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ id: "notification:n-1" }),
    );
  });

  it("says nothing for a frame that is not a notification", () => {
    const add = vi.spyOn(toast, "add");

    announceNotification(serverFrames.pong, presenceWith());
    announceNotification(serverFrames.snapshot, presenceWith());

    expect(add).not.toHaveBeenCalled();
  });
});
