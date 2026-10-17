"use client";

import { redirect, usePathname, useSearchParams } from "next/navigation";
import { type ReactNode, useState } from "react";

import { campusPreJoinHref } from "@/core/navigation";
import { useMountEffect } from "@/shared/lib/use-mount-effect";

import { useMediaSession } from "../services/media-session/media-session-provider";
import {
  useAdmission,
  usePresenceTab,
} from "../services/presence-session/presence-session-provider";
import { PresenceTabChoice } from "./presence-tab-choice";

interface PresenceSessionGateProps {
  children: ReactNode;
  cohortId: string;
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
  const { status, takeOver } = usePresenceTab();
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
  });

  // Taking the session back admits whichever cohort page this tab is on now.
  // The choice stays up until then: the tab holds the cohort a render before
  // it is admitted, and that render would redirect to pre-join.
  async function moveHere() {
    const href = relativeHref(pathname, searchParameters.toString());
    setIsMoving(true);
    await takeOver();
    grantEntry(href);
    completeEntry(href);
    connect(cohortId);
    setIsMoving(false);
  }

  if (status === "taken-over" || isMoving) {
    return <PresenceTabChoice onUseHere={moveHere} status="taken-over" />;
  }

  if (!admitted) {
    redirect(campusPreJoinHref(cohortId, initialRequest.href));
  }

  return children;
}
