import type { ReactNode } from "react";
import { vi } from "vitest";

import AdministrationLayout from "@/app/campus/[id]/(administration)/layout";
import {
  createAdmittedTestStore,
  createPresenceMediaTestStore,
  presenceSession,
} from "@/tests/fixtures/presence-session";

vi.mock(
  "next/navigation",
  () => import("@/tests/fixtures/active-campus-navigation-stub"),
);

export async function administrationLayout(
  children: ReactNode = <div />,
  mediaStore = createPresenceMediaTestStore(),
  admissionStore = createAdmittedTestStore(),
) {
  return presenceSession(
    await AdministrationLayout({
      children,
      params: Promise.resolve({ id: "c-1" }),
    }),
    mediaStore,
    admissionStore,
  );
}
