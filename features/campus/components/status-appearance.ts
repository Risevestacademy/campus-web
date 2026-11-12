import type { ChosenStatus } from "../services/status-choice/choose-status";

export const STATUS_LABELS: Record<ChosenStatus, string> = {
  available: "Available",
  busy: "Busy",
  away: "Away",
};

// Away is a ring, not a fill, so it differs from busy by shape as well as hue.
export const STATUS_BADGE_CLASS_NAMES: Record<ChosenStatus, string> = {
  available: "bg-success",
  busy: "bg-error",
  away: "bg-background border-warning-icon border-2",
};
