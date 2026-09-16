// @vitest-environment node

import { describe, expect, it } from "vitest";

import { createJsonLogger } from "./logger";

describe("createJsonLogger", () => {
  it("writes structured terminal records to the configured stream", () => {
    const informationRecords: string[] = [];
    const errorRecords: string[] = [];
    const logger = createJsonLogger({
      now: () => new Date("2026-09-09T10:00:00.000Z"),
      infoWriter: (record) => informationRecords.push(record),
      errorWriter: (record) => errorRecords.push(record),
    });

    logger.info("api.request.completed", {
      requestId: "request-1",
      status: 201,
    });
    logger.warn("api.request.rejected", {
      requestId: "request-2",
      status: 403,
    });

    expect(JSON.parse(informationRecords[0]!)).toEqual({
      requestId: "request-1",
      status: 201,
      timestamp: "2026-09-09T10:00:00.000Z",
      level: "info",
      event: "api.request.completed",
    });
    expect(JSON.parse(errorRecords[0]!)).toEqual({
      requestId: "request-2",
      status: 403,
      timestamp: "2026-09-09T10:00:00.000Z",
      level: "warn",
      event: "api.request.rejected",
    });
  });
});
