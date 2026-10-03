import { beforeEach, describe, expect, it } from "vitest";

import { loadMediaDevicePreferences } from "./media-device-preferences";

const STORAGE_KEY = "campus-media-device-preferences";

describe("loadMediaDevicePreferences", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("discards ids that earlier builds invented for permission placeholders", () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        cameraDeviceId: "videoinput-1",
        microphoneDeviceId: "audioinput-1",
        speakerDeviceId: "audiooutput-2",
      }),
    );

    expect(loadMediaDevicePreferences()).toEqual({
      cameraDeviceId: "",
      microphoneDeviceId: "",
      speakerDeviceId: "",
    });
  });

  it("keeps ids the browser issued", () => {
    const microphoneDeviceId =
      "6f1c2b7d9e0a4c3b8f5d2e1a0b9c8d7e6f5a4b3c2d1e0f9a8b7c6d5e4f3a2b1c";
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        cameraDeviceId: "camera-1",
        microphoneDeviceId,
        speakerDeviceId: "default",
      }),
    );

    expect(loadMediaDevicePreferences()).toEqual({
      cameraDeviceId: "camera-1",
      microphoneDeviceId,
      speakerDeviceId: "default",
    });
  });
});
