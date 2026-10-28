import { act, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type {
  MicrophoneLevelMeter,
  RenderLevel,
} from "../services/microphone-level/microphone-level-meter";
import { createTestMediaTrack } from "../testing/media-session-test-utils";
import { useMicrophoneLevelRef } from "./use-microphone-level-ref";

function fakeMeter() {
  let renderLevel: RenderLevel = () => undefined;
  const stop = vi.fn();
  const meter: MicrophoneLevelMeter = {
    follow: vi.fn((_track: MediaStreamTrack, render: RenderLevel) => {
      renderLevel = render;
      return stop;
    }),
  };
  return {
    meter,
    report: (level: number, speaking: boolean) => renderLevel(level, speaking),
    stop,
  };
}

function Meter({
  meter,
  track,
}: Readonly<{ meter: MicrophoneLevelMeter; track: MediaStreamTrack | null }>) {
  return <span data-testid="level" ref={useMicrophoneLevelRef(track, meter)} />;
}

describe("useMicrophoneLevelRef", () => {
  it("writes the measured level and speaking state onto the element", () => {
    const { meter, report } = fakeMeter();
    render(<Meter meter={meter} track={createTestMediaTrack("audio", "m")} />);

    act(() => report(0.64, true));

    const element = screen.getByTestId("level");
    expect(element.style.getPropertyValue("--mic-level")).toBe("0.640");
    expect(element).toHaveAttribute("data-speaking", "true");
  });

  it("keeps following the same track across renders", () => {
    const { meter } = fakeMeter();
    const track = createTestMediaTrack("audio", "m");
    const view = render(<Meter meter={meter} track={track} />);

    view.rerender(<Meter meter={meter} track={track} />);

    expect(meter.follow).toHaveBeenCalledOnce();
  });

  it("stops following and clears the level once the track goes", () => {
    const { meter, report, stop } = fakeMeter();
    const view = render(
      <Meter meter={meter} track={createTestMediaTrack("audio", "m")} />,
    );
    act(() => report(0.64, true));

    view.rerender(<Meter meter={meter} track={null} />);

    const element = screen.getByTestId("level");
    expect(stop).toHaveBeenCalledOnce();
    expect(element.style.getPropertyValue("--mic-level")).toBe("");
    expect(element).not.toHaveAttribute("data-speaking");
  });
});
