"use client";

import { redirect, usePathname, useSearchParams } from "next/navigation";
import { type ReactNode, useState } from "react";

import { campusPreJoinHref } from "@/core/navigation";
import { useMountEffect } from "@/shared/lib/use-mount-effect";

import { useMediaSession } from "../services/media-session/media-session-provider";
import { useAdmission } from "../services/presence-session/presence-session-provider";

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
  const wasAdmitted = useAdmission((state) => state.admitted);
  const pendingDestination = useAdmission((state) => state.pendingDestination);
  const completeEntry = useAdmission((state) => state.completeEntry);
  const connect = useMediaSession((state) => state.connect);
  // Snapshot at mount: client navigation inside an admitted session must not
  // re-evaluate the grant that admitted it.
  const [initialRequest] = useState(() => ({
    href: relativeHref(pathname, searchParameters.toString()),
    pendingDestination,
    wasAdmitted,
  }));
  const hasExactGrant =
    initialRequest.href === initialRequest.pendingDestination;
  const admitted = initialRequest.wasAdmitted || hasExactGrant;

  useMountEffect(() => {
    if (!admitted) return;

    if (hasExactGrant) completeEntry(initialRequest.href);
    connect(cohortId);
  });

  if (!admitted) {
    redirect(campusPreJoinHref(cohortId, initialRequest.href));
  }

  return children;
}
