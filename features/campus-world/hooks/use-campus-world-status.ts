import { useSyncExternalStore } from "react";

import type { CampusWorldStore } from "../store/campus-world-store";

export function useCampusWorldStatus(store: CampusWorldStore) {
  return useSyncExternalStore(
    store.subscribe,
    store.getState,
    store.getInitialState,
  );
}
