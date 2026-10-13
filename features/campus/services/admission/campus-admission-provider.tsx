"use client";

import { createContext, type ReactNode, useContext, useState } from "react";
import { useStore } from "zustand";

import {
  type CampusAdmissionState,
  type CampusAdmissionStore,
  createCampusAdmissionStore,
} from "./campus-admission-store";

const CampusAdmissionContext = createContext<CampusAdmissionStore | null>(null);
let documentStore: CampusAdmissionStore | undefined;

function getDocumentStore() {
  if (typeof window === "undefined") return createCampusAdmissionStore();

  documentStore ??= createCampusAdmissionStore();
  return documentStore;
}

export function CampusAdmissionProvider({
  children,
  store,
}: Readonly<{ children: ReactNode; store?: CampusAdmissionStore }>) {
  const [ownedStore] = useState(getDocumentStore);

  return (
    <CampusAdmissionContext.Provider value={store ?? ownedStore}>
      {children}
    </CampusAdmissionContext.Provider>
  );
}

export function useCampusAdmission<T>(
  selector: (state: CampusAdmissionState) => T,
): T {
  const store = useContext(CampusAdmissionContext);

  if (!store) {
    throw new Error(
      "useCampusAdmission must be used within CampusAdmissionProvider.",
    );
  }

  return useStore(store, selector);
}
