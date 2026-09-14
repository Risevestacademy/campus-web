// @vitest-environment node

import { describe, expect, it } from "vitest";
import { z } from "zod";

import type { LogFields, Logger } from "@/core/observability";

import { ApplicationError } from "./errors";
import { createAuthenticatedRoute } from "./handler";
import { parseInput } from "./validation";

interface LogRecord {
  event: string;
  fields: LogFields;
  level: "error" | "info" | "warn";
}

const staticRouteContext = {
  params: Promise.resolve({}),
};

function createRecordingLogger() {
  const records: LogRecord[] = [];
  const logger: Logger = {
    error: (event, fields) => records.push({ event, fields, level: "error" }),
    info: (event, fields) => records.push({ event, fields, level: "info" }),
    warn: (event, fields) => records.push({ event, fields, level: "warn" }),
  };

  return { logger, records };
}

describe("createAuthenticatedRoute", () => {
  it("returns a typed success response with correlated logging", async () => {
    const { logger, records } = createRecordingLogger();
    const times = [100, 112];
    let timeIndex = 0;
    const handler = createAuthenticatedRoute({
      routePattern: "/api/v1/profiles",
      successStatus: 201,
      logger,
      clock: () => times[timeIndex++] ?? 112,
      generateRequestId: () => "request-1",
      authenticate: () =>
        Promise.resolve({
          id: "actor-1",
          kind: "authenticated",
          permissions: ["profile:write"],
          roles: ["student"],
        }),
      parse: () => Promise.resolve({ displayName: "Ada" }),
      execute: (input, context) =>
        Promise.resolve({
          actorId: context.actor.id,
          displayName: input.displayName,
        }),
    });

    const response = await handler(
      new Request("https://example.test/api/v1/profiles", {
        method: "POST",
      }),
      staticRouteContext,
    );

    expect(response.status).toBe(201);
    expect(response.headers.get("x-request-id")).toBe("request-1");
    expect(await response.json()).toEqual({
      data: { actorId: "actor-1", displayName: "Ada" },
      meta: { requestId: "request-1" },
    });
    expect(records).toEqual([
      {
        event: "api.request.completed",
        level: "info",
        fields: {
          durationMs: 12,
          method: "POST",
          requestId: "request-1",
          route: "/api/v1/profiles",
          status: 201,
        },
      },
    ]);
  });

  it("authenticates before parsing or executing a protected request", async () => {
    const { logger } = createRecordingLogger();
    let parseCalls = 0;
    let executionCalls = 0;
    const handler = createAuthenticatedRoute({
      routePattern: "/api/v1/profiles",
      logger,
      generateRequestId: () => "request-2",
      authenticate: () => Promise.resolve(null),
      parse: () => {
        parseCalls += 1;
        return Promise.resolve({});
      },
      execute: () => {
        executionCalls += 1;
        return Promise.resolve({});
      },
    });

    const response = await handler(
      new Request("https://example.test/api/v1/profiles", {
        method: "POST",
      }),
      staticRouteContext,
    );

    expect(response.status).toBe(401);
    expect(parseCalls).toBe(0);
    expect(executionCalls).toBe(0);
    expect(await response.json()).toMatchObject({
      code: "unauthenticated",
      requestId: "request-2",
      status: 401,
    });
  });

  it("maps expected service failures to public problem contracts", async () => {
    const { logger } = createRecordingLogger();
    const handler = createAuthenticatedRoute({
      routePattern: "/api/v1/profiles",
      logger,
      generateRequestId: () => "request-3",
      authenticate: () =>
        Promise.resolve({
          id: "actor-1",
          kind: "authenticated",
          permissions: [],
          roles: [],
        }),
      parse: () => Promise.resolve({}),
      execute: () => {
        throw new ApplicationError("forbidden");
      },
    });

    const response = await handler(
      new Request("https://example.test/api/v1/profiles", {
        method: "POST",
      }),
      staticRouteContext,
    );

    expect(response.status).toBe(403);
    expect(response.headers.get("content-type")).toBe(
      "application/problem+json",
    );
    expect(await response.json()).toMatchObject({
      code: "forbidden",
      requestId: "request-3",
      status: 403,
    });
  });

  it("sanitizes unexpected failures while preserving server diagnostics", async () => {
    const { logger, records } = createRecordingLogger();
    const handler = createAuthenticatedRoute({
      routePattern: "/api/v1/profiles",
      logger,
      generateRequestId: () => "request-4",
      authenticate: () =>
        Promise.resolve({
          id: "actor-1",
          kind: "authenticated",
          permissions: [],
          roles: [],
        }),
      parse: () => Promise.resolve({}),
      execute: () => {
        throw new TypeError("database password appeared here");
      },
    });

    const response = await handler(
      new Request("https://example.test/api/v1/profiles", {
        method: "POST",
      }),
      staticRouteContext,
    );
    const problem = await response.json();

    expect(response.status).toBe(500);
    expect(problem).toMatchObject({
      code: "internal_error",
      detail: "An unexpected error occurred.",
      requestId: "request-4",
    });
    expect(JSON.stringify(problem)).not.toContain("database password");
    expect(records[0]).toMatchObject({
      event: "api.request.failed",
      level: "error",
      fields: {
        errorName: "TypeError",
        requestId: "request-4",
        status: 500,
      },
    });
  });

  it("passes asynchronous dynamic route params to the endpoint parser", async () => {
    const profileId = "550e8400-e29b-41d4-a716-446655440000";
    const routeParametersSchema = z.object({
      profileId: z.string().uuid(),
    });
    const { logger } = createRecordingLogger();
    const handler = createAuthenticatedRoute({
      routePattern: "/api/v1/profiles/[profileId]",
      logger,
      authenticate: () =>
        Promise.resolve({
          id: "actor-1",
          kind: "authenticated",
          permissions: ["profile:read"],
          roles: ["student"],
        }),
      parse: async (_request, routeContext) =>
        parseInput(routeParametersSchema, await routeContext.params),
      execute: (input) => Promise.resolve({ profileId: input.profileId }),
    });

    const response = await handler(
      new Request(`https://example.test/api/v1/profiles/${profileId}`),
      {
        params: Promise.resolve({ profileId }),
      },
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      data: { profileId },
    });
  });
});
