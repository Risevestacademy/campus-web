"use client";

import { createContext, type ReactNode, use } from "react";

import type { GrantOptions } from "../types/maps.types";

interface GrantContext {
  cohortId: string;
  options: GrantOptions;
}

const Context = createContext<GrantContext | null>(null);

// The cohort a space's list draws people, tracks and groups from, for every
// space's sheet on the map.
export function GrantOptionsProvider({
  value,
  children,
}: {
  value: GrantContext;
  children: ReactNode;
}) {
  return <Context value={value}>{children}</Context>;
}

export function useGrantOptions(): GrantContext {
  const context = use(Context);
  if (!context) {
    throw new Error("useGrantOptions needs a GrantOptionsProvider.");
  }
  return context;
}
