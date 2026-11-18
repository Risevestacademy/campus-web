import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { movementFor } from "@/core/realtime";
import { serverFrames } from "@/tests/fixtures/world-frames";

import { WalkOnArrival } from "./walk-on-arrival";

const navigation = vi.hoisted(() => ({ replace: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: navigation.replace }),
}));

let nextCohort = 0;

// The registry keeps one channel per cohort for the whole file.
function newCohort() {
  const cohortId = `cohort-${nextCohort++}`;
  const send = vi.fn(() => true);
  const movement = movementFor(cohortId);
  movement.bind(send);
  return { cohortId, movement, send };
}

beforeEach(() => {
  navigation.replace.mockClear();
});

describe("WalkOnArrival", () => {
  it("walks into the space at once when world has already placed the member", () => {
    const { cohortId, movement, send } = newCohort();
    movement.apply(serverFrames.welcome);
    movement.apply(serverFrames.snapshot);

    render(<WalkOnArrival cohortId={cohortId} spaceKey="library" />);

    expect(send).toHaveBeenCalledExactlyOnceWith({
      type: "goToSpace",
      spaceKey: "library",
    });
    expect(navigation.replace).toHaveBeenCalledExactlyOnceWith(
      `/campus/${cohortId}`,
    );
  });

  it("waits for world's snapshot, then walks once", () => {
    const { cohortId, movement, send } = newCohort();
    render(<WalkOnArrival cohortId={cohortId} spaceKey="library" />);

    expect(send).not.toHaveBeenCalled();
    expect(navigation.replace).not.toHaveBeenCalled();

    movement.apply(serverFrames.welcome);
    movement.apply(serverFrames.snapshot);
    movement.apply(serverFrames.snapshot);

    expect(send).toHaveBeenCalledExactlyOnceWith({
      type: "goToSpace",
      spaceKey: "library",
    });
    expect(navigation.replace).toHaveBeenCalledExactlyOnceWith(
      `/campus/${cohortId}`,
    );
  });

  it("keeps the request through a closed socket until the next snapshot", () => {
    const { cohortId, movement, send } = newCohort();
    render(<WalkOnArrival cohortId={cohortId} spaceKey="library" />);

    movement.apply(serverFrames.welcome);
    movement.disconnect();
    expect(send).not.toHaveBeenCalled();

    movement.apply(serverFrames.welcome);
    movement.apply(serverFrames.snapshot);

    expect(send).toHaveBeenCalledOnce();
  });

  it("stops listening once it unmounts", () => {
    const { cohortId, movement, send } = newCohort();
    const { unmount } = render(
      <WalkOnArrival cohortId={cohortId} spaceKey="library" />,
    );

    unmount();
    movement.apply(serverFrames.welcome);
    movement.apply(serverFrames.snapshot);

    expect(send).not.toHaveBeenCalled();
    expect(navigation.replace).not.toHaveBeenCalled();
  });
});
