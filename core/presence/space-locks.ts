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

// The mounted map answers a refused entry itself, with the offer to ask to
// enter. While no map claims a cohort's refusals, walk feedback says them.
const entryRefusalClaims = new Map<string, number>();

export function claimEntryRefusals(cohortId: string): () => void {
  entryRefusalClaims.set(cohortId, (entryRefusalClaims.get(cohortId) ?? 0) + 1);
  let released = false;
  return () => {
    if (released) return;
    released = true;
    const left = (entryRefusalClaims.get(cohortId) ?? 1) - 1;
    if (left > 0) entryRefusalClaims.set(cohortId, left);
    else entryRefusalClaims.delete(cohortId);
  };
}

export function entryRefusalsClaimed(cohortId: string): boolean {
  return entryRefusalClaims.has(cohortId);
}
