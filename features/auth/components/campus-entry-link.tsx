"use client";

import type { Route } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

import { rememberCampusEntry } from "../services/campus-entry-session.client";

export function CampusEntryLink({
  children,
  className,
  cohortId,
  href,
}: {
  children: ReactNode;
  className?: string;
  cohortId: string;
  href: Route;
}) {
  // A prefetch before the click records entry would cache the pre-join redirect.
  return (
    <Link
      href={href}
      className={className}
      prefetch={false}
      onClick={() => rememberCampusEntry(cohortId)}
    >
      {children}
    </Link>
  );
}
