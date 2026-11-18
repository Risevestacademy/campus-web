import type { Participant } from "@/core/presence";
import type { WorldSocial } from "@/core/realtime";

export type ChosenStatus = Parameters<WorldSocial["sendSetStatus"]>[0];

export interface StatusChoicePorts {
  social: Pick<WorldSocial, "sendSetStatus">;
  drawOwnStatus: (
    status: ChosenStatus,
    statusUntil: Participant["statusUntil"],
  ) => void;
  now: () => number;
}

// Drawn only once the frame is on its way, so a refused choice never shows.
export function chooseStatus(
  { social, drawOwnStatus, now }: StatusChoicePorts,
  status: ChosenStatus,
  forSeconds?: number,
): boolean {
  const sentAt = now();
  if (!social.sendSetStatus(status, forSeconds)) return false;
  drawOwnStatus(
    status,
    forSeconds === undefined
      ? null
      : new Date(sentAt + forSeconds * 1000).toISOString(),
  );
  return true;
}
