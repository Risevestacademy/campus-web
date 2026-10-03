import type { ReactNode } from "react";

// Stands in for @/features/auth where route layouts and pages are rendered for
// their markup, not their authorization: every visitor is an allowed member.
// Use as vi.mock("@/features/auth", () => import("@/tests/fixtures/route-access-stub")).

export const requireRouteAccess = () =>
  Promise.resolve({
    kind: "allow",
    session: {
      user: { systemRole: "user", email: "ada@campus.local" },
      memberships: [],
    },
  });

export const logsOutFromRail = () => true;

export function AccountMenu({ children }: { children: ReactNode }) {
  return children;
}

export function CohortGate({ children }: { children: ReactNode }) {
  return children;
}

export const SessionUnavailable = () => null;
