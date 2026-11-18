import { useStore } from "zustand";
import { useShallow } from "zustand/react/shallow";

import {
  isSpaceLocked,
  ownSpaceKeyOf,
  presenceFor,
  spaceNameOf,
} from "@/core/presence";
import { socialFor } from "@/core/realtime";

export type SpaceLock = Readonly<{
  canChange: boolean;
  locked: boolean;
  spaceName: string;
  toggle: () => void;
}>;

// The lock of the space the member stands in, or null outside a lockable one.
// World answers with `lockChanged` to everyone inside, so nothing is drawn
// ahead of it.
export function useSpaceLock(cohortId: string): SpaceLock | null {
  const state = useStore(
    presenceFor(cohortId),
    useShallow((presence) => {
      const spaceKey = ownSpaceKeyOf(presence);
      if (spaceKey === null || !presence.lockableSpaces.includes(spaceKey)) {
        return null;
      }
      return {
        canChange: presence.synced,
        locked: isSpaceLocked(presence, spaceKey),
        spaceName: spaceNameOf(presence, spaceKey),
      };
    }),
  );
  if (!state) return null;

  return {
    ...state,
    toggle: () => socialFor(cohortId).sendSetLock(!state.locked),
  };
}
