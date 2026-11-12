import { type Presence, spaceNameOf } from "./presence";

type LockView = Pick<
  Presence,
  "selfId" | "participants" | "lockableSpaces" | "lockedSpaces" | "spaceNames"
>;

export function ownSpaceKeyOf({
  selfId,
  participants,
}: Pick<Presence, "selfId" | "participants">): string | null {
  return selfId === null ? null : (participants.get(selfId)?.spaceKey ?? null);
}

export function isSpaceLocked(
  { lockedSpaces }: Pick<Presence, "lockedSpaces">,
  spaceKey: string,
): boolean {
  return lockedSpaces.includes(spaceKey);
}

// What the member is told when world refuses them a space: a refused step
// looks the same for a locked space and a listed one, so the locks say which.
export function refusedEntryNotice(
  presence: LockView,
  spaceKey: string | null,
): string {
  if (spaceKey === null) return "You can't enter that space";
  const name = spaceNameOf(presence, spaceKey);
  return isSpaceLocked(presence, spaceKey)
    ? `${name} is locked`
    : `You can't enter ${name}`;
}
