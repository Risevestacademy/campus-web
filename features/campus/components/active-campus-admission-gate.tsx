"use client";

import type { Route } from "next";
import { redirect, usePathname, useSearchParams } from "next/navigation";
import { type ReactNode, useState } from "react";

import {
  campusPreJoinHref,
  hasCampusPreJoinCompletion,
  removeCampusPreJoinCompletion,
} from "@/core/navigation";
import { useMountEffect } from "@/shared/lib/use-mount-effect";

interface ActiveCampusAdmissionGateProps {
  children: ReactNode;
  cohortId: string;
}

function activeHref(
  pathname: string,
  searchParameters: { toString(): string },
) {
  const search = searchParameters.toString();
  return search ? `${pathname}?${search}` : pathname;
}

export function ActiveCampusAdmissionGate({
  children,
  cohortId,
}: ActiveCampusAdmissionGateProps) {
  const pathname = usePathname();
  const searchParameters = useSearchParams();
  const [initialRequest] = useState(() => ({
    admitted: hasCampusPreJoinCompletion(searchParameters),
    href: activeHref(pathname, searchParameters),
  }));

  useMountEffect(() => {
    if (!initialRequest.admitted) return;

    const currentHref = [
      window.location.pathname,
      window.location.search,
      window.location.hash,
    ].join("");
    const cleanHref = removeCampusPreJoinCompletion(currentHref);

    if (currentHref !== cleanHref) {
      window.history.replaceState(window.history.state, "", cleanHref);
    }
  });

  if (!initialRequest.admitted) {
    redirect(campusPreJoinHref(cohortId, initialRequest.href) as Route);
  }

  return children;
}
