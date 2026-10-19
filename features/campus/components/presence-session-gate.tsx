"use client";

import { redirect, usePathname, useSearchParams } from "next/navigation";
import { type ReactNode, useState } from "react";

import { campusPreJoinHref } from "@/core/navigation";
import type { RealtimeStatus } from "@/core/realtime";
import { useMountEffect } from "@/shared/lib/use-mount-effect";

import { useMediaSession } from "../services/media-session/media-session-provider";
import {
  useAdmission,
  usePresenceTab,
} from "../services/presence-session/presence-session-provider";
import { useWorldSession } from "../services/world-session/world-session-provider";
import { PresenceTabChoice } from "./presence-tab-choice";

interface PresenceSessionGateProps {
  children: ReactNode;
  cohortId: string;
}

function isEnteredElsewhere(status: RealtimeStatus) {
  return status.phase === "closed" && status.outcome === "entered-elsewhere";
}

function relativeHref(pathname: string, search: string, hash = "") {
  const query = search.replace(/^\?/, "");
  return `${pathname}${query ? `?${query}` : ""}${hash}`;
}

export function PresenceSessionGate({
  children,
  cohortId,
}: PresenceSessionGateProps) {
  const pathname = usePathname();
  const searchParameters = useSearchParams();
  const isAdmitted = useAdmission((state) => state.admitted);
  const pendingDestination = useAdmission((state) => state.pendingDestination);
  const grantEntry = useAdmission((state) => state.grantEntry);
  const completeEntry = useAdmission((state) => state.completeEntry);
  const connect = useMediaSession((state) => state.connect);
  const startMedia = useMediaSession((state) => state.start);
  const { status, takeOver } = usePresenceTab();
  const world = useWorldSession();
  const [isMoving, setIsMoving] = useState(false);
  // Snapshot at mount: client navigation inside an admitted session must not
  // re-evaluate the grant that admitted it.
  const [initialRequest] = useState(() => ({
    href: relativeHref(pathname, searchParameters.toString()),
    pendingDestination,
    wasAdmitted: isAdmitted,
  }));
  const hasExactGrant =
    initialRequest.href === initialRequest.pendingDestination;
  // Use here admits after mount, so the live state counts too.
  const admitted = initialRequest.wasAdmitted || hasExactGrant || isAdmitted;

  useMountEffect(() => {
    if (!admitted) return;

    if (hasExactGrant) completeEntry(initialRequest.href);
    connect(cohortId);
    world.connect();
  });

  function admitCurrentPage() {
    const href = relativeHref(pathname, searchParameters.toString());
    grantEntry(href);
    completeEntry(href);
    connect(cohortId);
  }

  // Taking the session back admits whichever cohort page this tab is on now.
  // The choice stays up until then: the tab holds the cohort a render before
  // it is admitted, and that render would redirect to pre-join.
  async function moveHere() {
    setIsMoving(true);
    if (!(await takeOver())) {
      setIsMoving(false);
      return false;
    }
    admitCurrentPage();
    world.connect();
    setIsMoving(false);
    return true;
  }

  async function rejoinHere() {
    if (!(await takeOver())) return false;
    void startMedia();
    admitCurrentPage();
    world.reconnect();
    return true;
  }

  if (status === "taken-over" || isMoving) {
    return <PresenceTabChoice onUseHere={moveHere} status="taken-over" />;
  }

  if (isEnteredElsewhere(world.status)) {
    return (
      <PresenceTabChoice onUseHere={rejoinHere} status="entered-elsewhere" />
    );
  }

  if (!admitted) {
    redirect(campusPreJoinHref(cohortId, initialRequest.href));
  }

  return children;
}
