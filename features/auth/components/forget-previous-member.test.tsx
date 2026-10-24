import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { resetIdentifiedAnalyticsUser } from "@/core/analytics/client";

import { ForgetPreviousMember } from "./forget-previous-member";

vi.mock("@/core/analytics/client", () => ({
  resetIdentifiedAnalyticsUser: vi.fn(),
}));

describe("ForgetPreviousMember", () => {
  it("forgets an identified member once it mounts, and renders nothing", () => {
    const { container } = render(<ForgetPreviousMember />);

    expect(resetIdentifiedAnalyticsUser).toHaveBeenCalledOnce();
    expect(container).toBeEmptyDOMElement();
  });
});
