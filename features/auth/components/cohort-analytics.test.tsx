import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  enterAnalyticsCohort,
  identifyAnalyticsUser,
} from "@/core/analytics/client";

import { CohortAnalytics } from "./cohort-analytics";

const leaveCohort = vi.hoisted(() => vi.fn());

vi.mock("@/core/analytics/client", () => ({
  enterAnalyticsCohort: vi.fn(() => leaveCohort),
  identifyAnalyticsUser: vi.fn(),
}));

const identity = {
  id: "55555555-5555-4555-8555-555555555555",
  systemRole: "user",
} as const;
const cohort = {
  cohortId: "11111111-1111-4111-8111-111111111111",
  cohortRole: "student",
} as const;

describe("CohortAnalytics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("identifies the member and enters the cohort once it mounts, and renders nothing", () => {
    const { container } = render(
      <CohortAnalytics identity={identity} cohort={cohort} />,
    );

    expect(identifyAnalyticsUser).toHaveBeenCalledExactlyOnceWith(identity);
    expect(enterAnalyticsCohort).toHaveBeenCalledExactlyOnceWith(cohort);
    expect(leaveCohort).not.toHaveBeenCalled();
    expect(container).toBeEmptyDOMElement();
  });

  it("leaves the cohort when the cohort pages unmount", () => {
    const view = render(
      <CohortAnalytics identity={identity} cohort={cohort} />,
    );

    view.unmount();

    expect(leaveCohort).toHaveBeenCalledOnce();
  });
});
