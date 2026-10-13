"use client";

import { redirect, usePathname, useSearchParams } from "next/navigation";
import { type ReactNode, useState } from "react";

import { campusPreJoinHref } from "@/core/navigation";
import { useMountEffect } from "@/shared/lib/use-mount-effect";

import { useCampusAdmission } from "../services/admission/campus-admission-provider";

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
  const admittedCohortId = useCampusAdmission(
    (state) => state.admittedCohortId,
  );
  const pendingDestination = useCampusAdmission(
    (state) => state.pendingActiveCampusDestination,
  );
  const completeActiveCampusEntry = useCampusAdmission(
    (state) => state.completeActiveCampusEntry,
  );
  const [initialRequest] = useState(() => ({
    admittedCohortId,
    href: relativeHref(pathname, searchParameters.toString()),
    pendingDestination,
  }));
  const hasExactGrant =
    initialRequest.href === initialRequest.pendingDestination;
  const admitted =
    initialRequest.admittedCohortId === cohortId || hasExactGrant;

  useMountEffect(() => {
    if (hasExactGrant) {
      completeActiveCampusEntry(cohortId, initialRequest.href);
    }
  });

  if (!admitted) {
    redirect(campusPreJoinHref(cohortId, initialRequest.href));
  }

  return children;
}
