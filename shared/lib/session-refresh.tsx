"use client";

import { createContext, useContext } from "react";

export type RefreshSession = () => Promise<boolean>;

const refuseRefresh: RefreshSession = async () => false;

// A port: features that must renew the session cannot import features/auth,
// so the app composes auth's refresher in. Without one, nothing renews and
// callers take their sign-in path.
export const RefreshSessionContext =
  createContext<RefreshSession>(refuseRefresh);

export function useRefreshSession(): RefreshSession {
  return useContext(RefreshSessionContext);
}
