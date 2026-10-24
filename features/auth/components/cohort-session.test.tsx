import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { requireRouteAccess } from "../services/route-access.service";
import type { Session } from "../types/auth.types";
import { CohortSession } from "./cohort-session";

vi.mock("../services/route-access.service", () => ({
  requireRouteAccess: vi.fn(),
}));
vi.mock("./session-renewal-timer", () => ({
  SessionRenewalTimer: ({ expiresAt }: { expiresAt: string }) => (
    <p>{`renews ${expiresAt}`}</p>
  ),
}));
vi.mock("./cohort-analytics", () => ({
  CohortAnalytics: (props: object) => (
    <p>{`analytics ${JSON.stringify(props)}`}</p>
  ),
}));

const COHORT_3 = "11111111-1111-4111-8111-111111111111";
const EXPIRES_AT = "2026-10-23T12:15:00.000Z";

const session: Session = {
  scope: "full_access",
  expiresAt: EXPIRES_AT,
  inviteId: null,
  user: {
    id: "55555555-5555-4555-8555-555555555555",
    email: "ada@campus.local",
    displayName: "Ada Lovelace",
    systemRole: "admin",
  },
  memberships: [
    { cohortId: COHORT_3, role: "mentor", cohort: { name: "C3", code: "C3" } },
  ],
};

async function renderCohortSession() {
  return render(await CohortSession({ cohortId: COHORT_3 }));
}

describe("CohortSession", () => {
  beforeEach(() => {
    vi.mocked(requireRouteAccess).mockReset();
  });

  it("seeds renewal and analytics from one access read", async () => {
    vi.mocked(requireRouteAccess).mockResolvedValue({ kind: "allow", session });

    await renderCohortSession();

    expect(requireRouteAccess).toHaveBeenCalledExactlyOnceWith({
      kind: "cohort",
      cohortId: COHORT_3,
    });
    expect(screen.getByText(`renews ${EXPIRES_AT}`)).toBeInTheDocument();
    expect(
      screen.getByText(
        `analytics ${JSON.stringify({
          identity: {
            id: "55555555-5555-4555-8555-555555555555",
            systemRole: "admin",
          },
          cohort: { cohortId: COHORT_3, cohortRole: "mentor" },
        })}`,
      ),
    ).toBeInTheDocument();
  });

  it("renders nothing when access is not allowed", async () => {
    vi.mocked(requireRouteAccess).mockResolvedValue({
      kind: "unavailable",
      retryHref: `/campus/${COHORT_3}`,
    });

    const { container } = await renderCohortSession();

    expect(container).toBeEmptyDOMElement();
  });
});
