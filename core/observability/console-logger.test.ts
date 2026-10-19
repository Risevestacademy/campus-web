import { afterEach, describe, expect, it, vi } from "vitest";

import { createConsoleLogger } from "./console-logger";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("createConsoleLogger", () => {
  it("writes warnings and errors to the browser console", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const logger = createConsoleLogger();

    logger.warn("realtime.frame_skipped", { reason: "binary" });
    logger.error("realtime.frame_invalid", { type: "snapshot" });

    expect(warn).toHaveBeenCalledExactlyOnceWith("realtime.frame_skipped", {
      reason: "binary",
    });
    expect(error).toHaveBeenCalledExactlyOnceWith("realtime.frame_invalid", {
      type: "snapshot",
    });
  });

  it("drops information records, which only servers collect", () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const log = vi.spyOn(console, "log").mockImplementation(() => {});

    createConsoleLogger().info("realtime.connected", { attempt: 0 });

    expect(info).not.toHaveBeenCalled();
    expect(log).not.toHaveBeenCalled();
  });
});
