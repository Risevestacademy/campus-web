import {
  MOTION_CHANGE_EVENT,
  MOTION_STORAGE_KEY,
  type MotionPreference,
  parseMotionPreference,
  SERVER_MOTION_PREFERENCE,
} from "./motion";

function applyMotionPreference(preference: MotionPreference): void {
  if (preference === "reduce") {
    document.documentElement.dataset.motion = "reduce";
  } else {
    delete document.documentElement.dataset.motion;
  }
}

export function getMotionPreferenceSnapshot(): MotionPreference {
  return document.documentElement.dataset.motion === "reduce"
    ? "reduce"
    : "device";
}

export function getServerMotionPreferenceSnapshot(): MotionPreference {
  return SERVER_MOTION_PREFERENCE;
}

export function setMotionPreference(preference: MotionPreference): void {
  applyMotionPreference(preference);

  try {
    if (preference === "reduce") {
      window.localStorage.setItem(MOTION_STORAGE_KEY, preference);
    } else {
      window.localStorage.removeItem(MOTION_STORAGE_KEY);
    }
  } catch {
    // The active document still honours the choice without storage.
  }

  window.dispatchEvent(new Event(MOTION_CHANGE_EVENT));
}

export function subscribeToMotionPreference(
  onStoreChange: () => void,
): () => void {
  function handleStorage(event: StorageEvent): void {
    if (event.key !== MOTION_STORAGE_KEY) return;

    applyMotionPreference(parseMotionPreference(event.newValue));
    onStoreChange();
  }

  window.addEventListener(MOTION_CHANGE_EVENT, onStoreChange);
  window.addEventListener("storage", handleStorage);

  return () => {
    window.removeEventListener(MOTION_CHANGE_EVENT, onStoreChange);
    window.removeEventListener("storage", handleStorage);
  };
}
