import { z } from "zod";

import { parseJson } from "@/shared/lib/parse-json";

export type MediaDevicePreferences = Readonly<{
  cameraDeviceId: string;
  microphoneDeviceId: string;
  speakerDeviceId: string;
}>;

const LEGACY_STORAGE_KEY = "campus-media-control-preferences";
const STORAGE_KEY = "campus-media-device-preferences";

export const DEFAULT_MEDIA_DEVICE_PREFERENCES: MediaDevicePreferences = {
  cameraDeviceId: "",
  microphoneDeviceId: "",
  speakerDeviceId: "",
};

// Earlier builds saved ids invented for permission placeholders, such as
// "audioinput-1". No browser issues ids in that shape, so restoring one would
// select a device that does not exist.
const INVENTED_PLACEHOLDER_ID = /^(?:audioinput|videoinput|audiooutput)-\d+$/;

const deviceIdSchema = z
  .string()
  .refine((id) => !INVENTED_PLACEHOLDER_ID.test(id))
  .catch("");

const storedPreferencesSchema = z.object({
  cameraDeviceId: deviceIdSchema,
  microphoneDeviceId: deviceIdSchema,
  speakerDeviceId: deviceIdSchema,
});

export function loadMediaDevicePreferences(): MediaDevicePreferences {
  if (typeof window === "undefined") return DEFAULT_MEDIA_DEVICE_PREFERENCES;

  try {
    window.localStorage.removeItem(LEGACY_STORAGE_KEY);
    return (
      parseJson(
        storedPreferencesSchema,
        window.localStorage.getItem(STORAGE_KEY),
      ) ?? DEFAULT_MEDIA_DEVICE_PREFERENCES
    );
  } catch {
    return DEFAULT_MEDIA_DEVICE_PREFERENCES;
  }
}

export function saveMediaDevicePreferences(
  preferences: MediaDevicePreferences,
): void {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
  } catch {
    // The active session still honors the selection when storage is unavailable.
  }
}
