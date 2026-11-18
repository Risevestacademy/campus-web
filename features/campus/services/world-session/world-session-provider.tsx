"use client";

import {
  createContext,
  type ReactNode,
  useContext,
  useSyncExternalStore,
} from "react";

import type { RealtimeStatus } from "@/core/realtime";

import type { WorldSession } from "./world-session";

const WorldSessionContext = createContext<WorldSession | null>(null);

export function WorldSessionProvider({
  children,
  world,
}: Readonly<{ children: ReactNode; world: WorldSession }>) {
  return (
    <WorldSessionContext.Provider value={world}>
      {children}
    </WorldSessionContext.Provider>
  );
}

// The server opens no socket.
const IDLE: RealtimeStatus = { phase: "idle" };
const getServerStatus = () => IDLE;

export function useWorldSession() {
  const world = useContext(WorldSessionContext);

  if (!world) {
    throw new Error(
      "useWorldSession must be used within WorldSessionProvider.",
    );
  }

  const status = useSyncExternalStore(
    world.subscribe,
    world.getStatus,
    getServerStatus,
  );
  return { connect: world.connect, reconnect: world.reconnect, status };
}
