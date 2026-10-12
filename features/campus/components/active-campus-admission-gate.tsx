"use client";

import { redirect, usePathname, useSearchParams } from "next/navigation";
import { type ReactNode, useState } from "react";

import { campusPreJoinHref } from "@/core/navigation";
import { useMountEffect } from "@/shared/lib/use-mount-effect";

import { useMediaSession } from "../services/media-session/media-session-provider";

interface ActiveCampusAdmissionGateProps {
  children: ReactNode;
  cohortId: string;
}

function relativeHref(pathname: string, search: string, hash = "") {
  const query = search.replace(/^\?/, "");
  return `${pathname}${query ? `?${query}` : ""}${hash}`;
}

export function ActiveCampusAdmissionGate({
  children,
  cohortId,
}: ActiveCampusAdmissionGateProps) {
  const pathname = usePathname();
  const searchParameters = useSearchParams();
  const pendingDestination = useMediaSession(
    (state) => state.pendingActiveCampusDestination,
  );
  const clearActiveCampusEntry = useMediaSession(
    (state) => state.clearActiveCampusEntry,
  );
  const [initialRequest] = useState(() => ({
    href: relativeHref(pathname, searchParameters.toString()),
    pendingDestination,
  }));
  const admitted = initialRequest.href === initialRequest.pendingDestination;

  useMountEffect(() => {
    if (admitted) clearActiveCampusEntry(initialRequest.href);
  });

  if (!admitted) {
    redirect(campusPreJoinHref(cohortId, initialRequest.href));
  }

  return children;
}
