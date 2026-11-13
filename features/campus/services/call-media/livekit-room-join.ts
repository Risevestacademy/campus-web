import type { LivekitClient } from "../livekit/livekit-client";
import { RoomAccessDeniedError } from "./contracts";

export const CONNECT_OPTIONS = { autoSubscribe: false, maxRetries: 3 };

export function untilAborted<T>(work: Promise<T>, signal: AbortSignal) {
  return new Promise<T>((resolve, reject) => {
    signal.throwIfAborted();
    const abort = () => reject(signal.reason);
    signal.addEventListener("abort", abort, { once: true });
    work
      .then(resolve, reject)
      .finally(() => signal.removeEventListener("abort", abort));
  });
}

export function joinFailure(
  {
    ConnectionError,
    ConnectionErrorReason,
  }: Pick<LivekitClient, "ConnectionError" | "ConnectionErrorReason">,
  error: unknown,
) {
  return error instanceof ConnectionError &&
    error.reason === ConnectionErrorReason.NotAllowed
    ? new RoomAccessDeniedError(error.message)
    : error;
}
