import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { identifyAnalyticsUser } from "@/core/analytics/client";

import { IdentifyAnalyticsUser } from "./identify-analytics-user";

vi.mock("@/core/analytics/client", () => ({
  identifyAnalyticsUser: vi.fn(),
}));

const identity = {
  id: "55555555-5555-4555-8555-555555555555",
  cohortId: "11111111-1111-4111-8111-111111111111",
  role: "student",
} as const;

describe("IdentifyAnalyticsUser", () => {
  it("identifies the member once it mounts, and renders nothing", () => {
    const { container } = render(<IdentifyAnalyticsUser identity={identity} />);

    expect(identifyAnalyticsUser).toHaveBeenCalledExactlyOnceWith(identity);
    expect(container).toBeEmptyDOMElement();
  });
});
