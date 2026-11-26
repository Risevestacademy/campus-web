import { useStore } from "zustand";
import { useShallow } from "zustand/react/shallow";

import {
  DEFAULT_SPACE_KEY,
  ownSpaceKeyOf,
  presenceFor,
  spaceIdOfRoom,
  spaceNameOf,
} from "@/core/presence";

export type OwnSpace = Readonly<{ id: string; name: string }>;

// The space the member stands in, with the id campus-api wants for a link.
// World only names that id in the call for the space, so it is null in the
// corridors, before the call arrives and while the socket is down.
export function useOwnSpace(cohortId: string): OwnSpace | null {
  return useStore(
    presenceFor(cohortId),
    useShallow((presence) => {
      const spaceKey = ownSpaceKeyOf(presence);
      const id = spaceIdOfRoom(presence.spaceRoom, cohortId);
      if (!presence.synced || spaceKey === null || id === null) return null;
      if (spaceKey === DEFAULT_SPACE_KEY) return null;
      return { id, name: spaceNameOf(presence, spaceKey) };
    }),
  );
}
