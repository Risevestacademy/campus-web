import type { ReactNode } from "react";

import ActiveCampusLayout from "@/app/(app)/campus/[id]/(active-campus)/layout";

// The layout is an async Server Component; RTL renders only what it resolves
// to. Pair with the route-access stub, since the layout reads the session.
export function activeCampusLayout(children: ReactNode = <div />) {
  return ActiveCampusLayout({
    children,
    params: Promise.resolve({ id: "c-1" }),
  });
}
