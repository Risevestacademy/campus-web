"use client";

import type { Route } from "next";
import { useRouter } from "next/navigation";
import { type ReactNode, useState } from "react";

import {
  useAdmission,
  usePresenceTab,
} from "../services/presence-session/presence-session-provider";
import {
  isPresenceTabChoice,
  PresenceTabChoice,
  type PresenceTabChoiceStatus,
} from "./presence-tab-choice";

// Device setup would capture the camera a second time, so it waits until no
// other tab holds the cohort.
export function PreJoinPresenceTab({
  children,
  destination,
}: Readonly<{ children: ReactNode; destination: string }>) {
  const router = useRouter();
  const { status, takeOver } = usePresenceTab();
  const grantEntry = useAdmission((state) => state.grantEntry);
  const [movingFrom, setMovingFrom] = useState<PresenceTabChoiceStatus>();
  const choice = movingFrom ?? (isPresenceTabChoice(status) ? status : null);

  // The choice stays up after the move so device setup never flashes before
  // the navigation lands.
  async function moveHere() {
    if (!choice) return false;

    setMovingFrom(choice);
    if (!(await takeOver())) {
      setMovingFrom(undefined);
      return false;
    }
    grantEntry(destination);
    router.push(destination as Route);
    return true;
  }

  if (choice) return <PresenceTabChoice onUseHere={moveHere} status={choice} />;
  if (status === "checking") return null;
  return children;
}
