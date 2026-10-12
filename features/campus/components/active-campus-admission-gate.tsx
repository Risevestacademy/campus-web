"use client";

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
  const [initialRequest] = useState(() => ({
    admitted: hasCampusPreJoinCompletion(searchParameters),
    href: relativeHref(pathname, searchParameters.toString()),
  }));

  useMountEffect(() => {
    if (!initialRequest.admitted) return;

    const { hash, pathname: currentPathname, search } = window.location;
    const currentHref = relativeHref(currentPathname, search, hash);
    const cleanHref = removeCampusPreJoinCompletion(currentHref);

    if (currentHref !== cleanHref) {
      window.history.replaceState(window.history.state, "", cleanHref);
    }
  });

  if (!initialRequest.admitted) {
    redirect(campusPreJoinHref(cohortId, initialRequest.href));
  }

  return children;
}
