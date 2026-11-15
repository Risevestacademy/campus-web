import { useRef, useState } from "react";

import { useMountEffect } from "@/shared/lib/use-mount-effect";

import type {
  CaptureSource,
  MediaSessionErrorCode,
} from "../services/media-session/contracts";
import { useMediaSession } from "../services/media-session/media-session-provider";

export type DeviceTest = Readonly<{
  error: MediaSessionErrorCode | null;
  isStarting: boolean;
  track: MediaStreamTrack | null;
}>;

const OFF: DeviceTest = { error: null, isStarting: false, track: null };

// A local capture of the selected camera or microphone, for Settings to show
// it working. It is never published, and it stops when the test stops, when
// the device ends, or when the component that started it unmounts.
export function useDeviceTest(source: CaptureSource) {
  const captureTestTrack = useMediaSession((state) => state.captureTestTrack);
  const [test, setTest] = useState<DeviceTest>(OFF);
  const current = useRef<MediaStreamTrack | null>(null);
  const attempt = useRef(0);

  function release() {
    current.current?.stop();
    current.current = null;
  }

  function stop() {
    attempt.current += 1;
    release();
    setTest(OFF);
  }

  async function start() {
    const thisAttempt = ++attempt.current;
    release();
    setTest({ error: null, isStarting: true, track: null });

    const result = await captureTestTrack(source);

    if (thisAttempt !== attempt.current) {
      if ("track" in result) result.track.stop();
      return;
    }

    if ("error" in result) {
      setTest({ error: result.error, isStarting: false, track: null });
      return;
    }

    const { track } = result;
    current.current = track;
    track.addEventListener("ended", () => {
      if (current.current === track) stop();
    });
    setTest({ error: null, isStarting: false, track });
  }

  // A device switch mid-test moves the test to the new device.
  function restartIfRunning() {
    if (current.current || test.isStarting) void start();
  }

  useMountEffect(() => () => {
    attempt.current += 1;
    release();
  });

  return {
    ...test,
    isRunning: test.track !== null || test.isStarting,
    restartIfRunning,
    start: () => void start(),
    stop,
  };
}
