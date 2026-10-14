import type { ReactNode } from "react";
import { vi } from "vitest";

import ActiveCampusLayout from "@/app/campus/[id]/(active-campus)/layout";
import {
  createPresenceAdmissionTestStore,
  createPresenceMediaTestStore,
  presenceSession,
} from "@/tests/fixtures/presence-session";

vi.mock(
  "next/navigation",
  () => import("@/tests/fixtures/active-campus-navigation-stub"),
);

const params = Promise.resolve({ id: "c-1" });

// Layouts are async Server Components; RTL renders only what they resolve to.
// Pair with the route-access stub, since the layouts read the session.
export async function activeCampusLayout(
  children: ReactNode = <div />,
  mediaStore = createPresenceMediaTestStore(),
  admissionStore = createPresenceAdmissionTestStore(),
) {
  const { admitted, grantEntry, pendingDestination } =
    admissionStore.getState();
  if (!admitted && pendingDestination === null) grantEntry("/campus/c-1");

  return presenceSession(
    await ActiveCampusLayout({ children, params }),
    mediaStore,
    admissionStore,
  );
}
