"use client";

import type { ReactNode } from "react";

import { useLogOut } from "../hooks/use-log-out";

// Logging out for a control another feature draws: routes pass this in, and
// the feature supplies the look. The session ends the same way as from the
// account menu.
export function LogOutAction({
  children,
}: {
  children: (action: { logOut: () => void; isPending: boolean }) => ReactNode;
}) {
  return children(useLogOut());
}
