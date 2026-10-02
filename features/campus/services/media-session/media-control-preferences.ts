export type MediaControlPreferences = Readonly<{
  cameraEnabled: boolean;
  microphoneEnabled: boolean;
}>;

const STORAGE_KEY = "campus-media-control-preferences";
export const DEFAULT_MEDIA_CONTROL_PREFERENCES: MediaControlPreferences = {
  cameraEnabled: false,
  microphoneEnabled: false,
};

export function readMediaControlPreferences(): MediaControlPreferences {
  if (typeof window === "undefined") return DEFAULT_MEDIA_CONTROL_PREFERENCES;

  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    if (!value) return DEFAULT_MEDIA_CONTROL_PREFERENCES;

    const stored = JSON.parse(value) as Partial<MediaControlPreferences>;
    return {
      cameraEnabled: stored.cameraEnabled === true,
      microphoneEnabled: stored.microphoneEnabled === true,
    };
  } catch {
    return DEFAULT_MEDIA_CONTROL_PREFERENCES;
  }
}

export function writeMediaControlPreferences(
  preferences: MediaControlPreferences,
): void {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
  } catch {
    // The active session still honors the choice when storage is unavailable.
  }
}
