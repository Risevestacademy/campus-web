import { render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CalendarOutcomeNotice } from "./calendar-outcome-notice";

const router = vi.hoisted(() => ({ replace: vi.fn() }));
const toasts = vi.hoisted(() => ({ add: vi.fn() }));

vi.mock("next/navigation", () => ({
  usePathname: () => "/campus/c-1/calendar",
  useRouter: () => router,
}));
vi.mock("@/shared/ui/toast", () => ({ toast: toasts }));

afterEach(() => {
  vi.useRealTimers();
});

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  window.history.replaceState(null, "", "/campus/c-1/calendar?calendar=denied");
});

describe("CalendarOutcomeNotice", () => {
  it("says how connecting went and shows nothing of its own", () => {
    const { container } = render(<CalendarOutcomeNotice outcome="denied" />);
    vi.runAllTimers();

    expect(toasts.add).toHaveBeenCalledExactlyOnceWith({
      id: "calendar-outcome",
      title: "You cancelled at Google, so nothing was connected.",
      type: "warning",
    });
    expect(container).toBeEmptyDOMElement();
  });

  it("waits until the toaster has subscribed, which is after this mounts", () => {
    render(<CalendarOutcomeNotice outcome="denied" />);

    expect(toasts.add).not.toHaveBeenCalled();
    vi.runAllTimers();
    expect(toasts.add).toHaveBeenCalledOnce();
  });

  it("still says it when the page it sits on goes first", () => {
    const { unmount } = render(<CalendarOutcomeNotice outcome="denied" />);

    unmount();
    vi.runAllTimers();

    expect(toasts.add).toHaveBeenCalledOnce();
  });

  it("takes the outcome off the address so a reload does not say it again", () => {
    render(<CalendarOutcomeNotice outcome="denied" />);
    vi.runAllTimers();

    expect(router.replace).toHaveBeenCalledExactlyOnceWith(
      "/campus/c-1/calendar",
      { scroll: false },
    );
  });

  it("keeps any other part of the address", () => {
    window.history.replaceState(
      null,
      "",
      "/campus/c-1/calendar?calendar=connected&week=2026-09-28",
    );

    render(<CalendarOutcomeNotice outcome="connected" />);
    vi.runAllTimers();

    expect(router.replace).toHaveBeenCalledWith(
      "/campus/c-1/calendar?week=2026-09-28",
      { scroll: false },
    );
  });
});
