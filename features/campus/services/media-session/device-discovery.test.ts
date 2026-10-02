import { describe, expect, it, vi } from "vitest";

import type { DeviceCatalogSnapshot } from "./contracts";
import { createDeviceCatalog, discoverMediaDevices } from "./device-discovery";

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });

  return { promise, resolve };
}

function createDevice(
  deviceId: string,
  kind: MediaDeviceKind,
  label: string,
): MediaDeviceInfo {
  const device = { deviceId, groupId: `${deviceId}-group`, kind, label };
  return { ...device, toJSON: () => device } as MediaDeviceInfo;
}

describe("discoverMediaDevices", () => {
  it("groups exposed devices and normalizes the system-default label", async () => {
    const mediaDevices = {
      enumerateDevices: vi
        .fn()
        .mockResolvedValue([
          createDevice("default", "audioinput", "Default - MacBook Microphone"),
          createDevice("camera-1", "videoinput", "Studio Camera"),
          createDevice("speaker-1", "audiooutput", "Studio Speakers"),
        ]),
    } as unknown as MediaDevices;

    await expect(discoverMediaDevices(mediaDevices)).resolves.toEqual({
      cameras: [{ id: "camera-1", isDefault: false, label: "Studio Camera" }],
      microphones: [
        {
          id: "default",
          isDefault: true,
          label: "MacBook Microphone",
        },
      ],
      speakers: [
        { id: "speaker-1", isDefault: false, label: "Studio Speakers" },
      ],
    });
  });

  it("serializes concurrent refreshes and publishes only the trailing catalog", async () => {
    const firstEnumeration = createDeferred<MediaDeviceInfo[]>();
    const trailingEnumeration = createDeferred<MediaDeviceInfo[]>();
    const enumerateDevices = vi
      .fn()
      .mockReturnValueOnce(firstEnumeration.promise)
      .mockReturnValueOnce(trailingEnumeration.promise);
    const snapshots: DeviceCatalogSnapshot[] = [];
    const catalog = createDeviceCatalog({
      mediaDevices: { enumerateDevices },
      onSnapshot: (snapshot) => snapshots.push(snapshot),
    });

    const firstRefresh = catalog.refresh();
    const trailingRefresh = catalog.refresh();

    expect(enumerateDevices).toHaveBeenCalledOnce();

    firstEnumeration.resolve([
      createDevice("camera-old", "videoinput", "Old Camera"),
    ]);

    await vi.waitFor(() => {
      expect(enumerateDevices).toHaveBeenCalledTimes(2);
    });
    expect(snapshots.some((snapshot) => snapshot.status === "ready")).toBe(
      false,
    );

    trailingEnumeration.resolve([
      createDevice("camera-new", "videoinput", "New Camera"),
    ]);

    await expect(
      Promise.all([firstRefresh, trailingRefresh]),
    ).resolves.toMatchObject([
      {
        catalog: {
          cameras: [
            {
              id: "camera-new",
              isDefault: false,
              label: "New Camera",
            },
          ],
        },
        error: null,
        status: "ready",
      },
      {
        catalog: {
          cameras: [
            {
              id: "camera-new",
              isDefault: false,
              label: "New Camera",
            },
          ],
        },
        error: null,
        status: "ready",
      },
    ]);
  });

  it("retains the last-good catalog when a later refresh fails", async () => {
    const enumerateDevices = vi
      .fn()
      .mockResolvedValueOnce([
        createDevice("camera-1", "videoinput", "Studio Camera"),
      ])
      .mockRejectedValueOnce(new Error("enumeration failed"));
    const snapshots: DeviceCatalogSnapshot[] = [];
    const catalog = createDeviceCatalog({
      mediaDevices: { enumerateDevices },
      onSnapshot: (snapshot) => snapshots.push(snapshot),
    });

    await catalog.refresh();

    await expect(catalog.refresh()).resolves.toMatchObject({
      catalog: {
        cameras: [
          {
            id: "camera-1",
            isDefault: false,
            label: "Studio Camera",
          },
        ],
      },
      error: "enumeration-failed",
      status: "stale",
    });
    expect(snapshots.at(-1)).toMatchObject({
      error: "enumeration-failed",
      status: "stale",
    });
  });

  it("reports an initial enumeration failure without rejecting", async () => {
    const snapshots: DeviceCatalogSnapshot[] = [];
    const catalog = createDeviceCatalog({
      mediaDevices: {
        enumerateDevices: vi
          .fn()
          .mockRejectedValue(new Error("enumeration failed")),
      },
      onSnapshot: (snapshot) => snapshots.push(snapshot),
    });

    await expect(catalog.refresh()).resolves.toEqual({
      catalog: null,
      error: "enumeration-failed",
      status: "failed",
    });
    expect(snapshots.at(-1)).toEqual({
      catalog: null,
      error: "enumeration-failed",
      status: "failed",
    });
  });

  it("does not publish a pending result after reset", async () => {
    const enumeration = createDeferred<MediaDeviceInfo[]>();
    const snapshots: DeviceCatalogSnapshot[] = [];
    const catalog = createDeviceCatalog({
      mediaDevices: {
        enumerateDevices: vi.fn().mockReturnValue(enumeration.promise),
      },
      onSnapshot: (snapshot) => snapshots.push(snapshot),
    });

    const refresh = catalog.refresh();
    catalog.reset();

    enumeration.resolve([
      createDevice("camera-late", "videoinput", "Late Camera"),
    ]);
    await refresh;

    expect(snapshots.some((snapshot) => snapshot.status === "ready")).toBe(
      false,
    );
    expect(snapshots.at(-1)).toEqual({
      catalog: null,
      error: null,
      status: "idle",
    });
  });

  it("runs a post-reset refresh after the invalidated enumeration settles", async () => {
    const invalidatedEnumeration = createDeferred<MediaDeviceInfo[]>();
    const currentEnumeration = createDeferred<MediaDeviceInfo[]>();
    const enumerateDevices = vi
      .fn()
      .mockReturnValueOnce(invalidatedEnumeration.promise)
      .mockReturnValueOnce(currentEnumeration.promise);
    const snapshots: DeviceCatalogSnapshot[] = [];
    const catalog = createDeviceCatalog({
      mediaDevices: { enumerateDevices },
      onSnapshot: (snapshot) => snapshots.push(snapshot),
    });

    const invalidatedRefresh = catalog.refresh();
    catalog.reset();
    const currentRefresh = catalog.refresh();

    invalidatedEnumeration.resolve([
      createDevice("camera-old", "videoinput", "Old Camera"),
    ]);
    await vi.waitFor(() => {
      expect(enumerateDevices).toHaveBeenCalledTimes(2);
    });

    currentEnumeration.resolve([
      createDevice("camera-current", "videoinput", "Current Camera"),
    ]);
    await Promise.all([invalidatedRefresh, currentRefresh]);

    expect(snapshots.filter((snapshot) => snapshot.status === "ready")).toEqual(
      [
        {
          catalog: {
            cameras: [
              {
                id: "camera-current",
                isDefault: false,
                label: "Current Camera",
              },
            ],
            microphones: [],
            speakers: [],
          },
          error: null,
          status: "ready",
        },
      ],
    );
  });
});
