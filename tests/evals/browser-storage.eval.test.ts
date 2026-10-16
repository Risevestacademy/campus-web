import { beforeEach, describe, expect, it } from "vitest";

import { sharedSessionExpiry } from "@/features/auth/services/browser-session";
import { parseStoredSidebarPreferences } from "@/features/campus/schemas/sidebar-preferences.schema";
import { loadMediaDevicePreferences } from "@/features/campus/services/media-session/media-device-preferences";

// Anyone with the page open (an extension, a script, a stale build) can edit
// localStorage, so every value read back is treated as untrusted input.

const SHARED_EXPIRY_KEY = "campus.session-expires-at";
const PREFERENCES_KEY = "campus-media-device-preferences";
const MINUTE = 60_000;
const INVENTED_PLACEHOLDER_ID = /^(?:audioinput|videoinput|audiooutput)-\d+$/;

beforeEach(() => {
  localStorage.clear();
});

describe("Browser storage eval (threshold: every case holds)", () => {
  describe("a stored session expiry never postpones renewal", () => {
    it.each([
      String(Date.parse("2099-01-01T00:00:00.000Z")),
      String(Date.now() + 16 * MINUTE),
      "Infinity",
      "1e308",
      "-1",
      "0",
      "abc",
      "",
    ])("ignores %j", (value) => {
      localStorage.setItem(SHARED_EXPIRY_KEY, value);

      expect(sharedSessionExpiry.read()).toBeUndefined();
    });

    it("follows an expiry another tab's renewal could have written", () => {
      const expiresAt = Date.now() + 10 * MINUTE;
      localStorage.setItem(SHARED_EXPIRY_KEY, String(expiresAt));

      expect(sharedSessionExpiry.read()).toBe(expiresAt);
    });
  });

  describe("stored media preferences only ever select real device ids", () => {
    it.each([
      "not json",
      "null",
      "[]",
      '"camera-1"',
      '{"cameraDeviceId":{}}',
      '{"__proto__":{"cameraDeviceId":"injected"}}',
      '{"cameraDeviceId":"videoinput-1","speakerDeviceId":["default"]}',
    ])("reads %s as three plain device ids", (value) => {
      localStorage.setItem(PREFERENCES_KEY, value);

      const preferences = loadMediaDevicePreferences();

      expect(Object.keys(preferences).sort()).toEqual([
        "cameraDeviceId",
        "microphoneDeviceId",
        "speakerDeviceId",
      ]);
      for (const id of Object.values(preferences)) {
        expect(typeof id).toBe("string");
        expect(id).not.toMatch(INVENTED_PLACEHOLDER_ID);
        expect(id).not.toBe("injected");
      }
    });
  });

  describe("stored sidebar preferences only ever restore a known panel and mode", () => {
    const DEFAULTS = {
      activePanel: "map",
      sidebarMode: undefined,
      sidebarOpen: true,
    };

    it.each([
      "not json",
      "null",
      "[]",
      '"chat"',
      '{"activePanel":"admin-secrets","sidebarMode":"root"}',
      '{"sidebarOpen":"false"}',
      '{"__proto__":{"sidebarOpen":false}}',
    ])("reads %s as the defaults", (value) => {
      expect(parseStoredSidebarPreferences(value)).toEqual(DEFAULTS);
    });

    it("keeps each valid field when another one is corrupted", () => {
      expect(
        parseStoredSidebarPreferences(
          '{"activePanel":"chat","sidebarMode":"admin","sidebarOpen":"yes"}',
        ),
      ).toEqual({
        activePanel: "chat",
        sidebarMode: "admin",
        sidebarOpen: true,
      });
    });
  });
});
