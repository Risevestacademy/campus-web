"use client";

import { createContext, type ReactNode, useContext, useState } from "react";
import { useStore } from "zustand";

import { CampusMediaSessionProvider } from "../media-session/media-session-provider";
import {
  type AdmissionState,
  type AdmissionStore,
  createAdmissionStore,
} from "./admission-store";

const AdmissionContext = createContext<AdmissionStore | null>(null);

export function AdmissionProvider({
  children,
  store,
}: Readonly<{ children: ReactNode; store: AdmissionStore }>) {
  return (
    <AdmissionContext.Provider value={store}>
      {children}
    </AdmissionContext.Provider>
  );
}

export function PresenceSessionProvider({
  children,
}: Readonly<{ children: ReactNode }>) {
  const [admissionStore] = useState(createAdmissionStore);

  return (
    <AdmissionProvider store={admissionStore}>
      <CampusMediaSessionProvider>{children}</CampusMediaSessionProvider>
    </AdmissionProvider>
  );
}

export function useAdmission<T>(selector: (state: AdmissionState) => T): T {
  const store = useContext(AdmissionContext);

  if (!store) {
    throw new Error("useAdmission must be used within AdmissionProvider.");
  }

  return useStore(store, selector);
}
