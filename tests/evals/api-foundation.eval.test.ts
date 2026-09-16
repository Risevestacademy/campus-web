// @vitest-environment node

import { describe, expect, it } from "vitest";
import { z } from "zod";

import type { AuthenticatedActor, RouteExecutionContext } from "@/core/api";
import {
  ApplicationError,
  createAuthenticatedRoute,
  parseInput,
  parseJsonBody,
} from "@/core/api";
import type { Logger } from "@/core/observability";

const quietLogger: Logger = {
  error: () => {},
  info: () => {},
  warn: () => {},
};

const staticRouteContext = {
  params: Promise.resolve({}),
};

const inputSchema = z.object({
  displayName: z.string().min(1),
});

type Input = z.output<typeof inputSchema>;
type OperationResult = { id: string; displayName: string };
type Operation = (
  input: Input,
  context: RouteExecutionContext<AuthenticatedActor>,
) => Promise<OperationResult>;

function createHarness(operation: Operation) {
  const handler = createAuthenticatedRoute({
    routePattern: "/api/v1/eval-resource",
    successStatus: 201,
    logger: quietLogger,
    generateRequestId: () => "eval-request",
    authenticate: (request) =>
      Promise.resolve(
        request.headers.get("authorization") === "Bearer valid"
          ? {
              id: "verified-actor",
              kind: "authenticated",
              permissions: ["resource:write"],
              roles: ["student"],
            }
          : null,
      ),
    parse: (request) => parseJsonBody(request, inputSchema),
    execute: operation,
  });

  return handler;
}

function createRequest(body: unknown, authorization = "Bearer valid"): Request {
  return new Request("https://example.test/api/v1/eval-resource", {
    method: "POST",
    headers: {
      authorization,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

function createDeclaredOversizedRequest(): Request {
  return new Request("https://example.test/api/v1/eval-resource", {
    method: "POST",
    headers: {
      authorization: "Bearer valid",
      "content-length": String(1_048_577),
      "content-type": "application/json",
    },
    body: JSON.stringify({ displayName: "Ada" }),
  });
}

describe("API foundation eval (required threshold: 7/7)", () => {
  it("returns a correlated success contract", async () => {
    const handler = createHarness((input, context) =>
      Promise.resolve({
        id: `${context.actor.id}-resource`,
        displayName: input.displayName,
      }),
    );

    const response = await handler(
      createRequest({ displayName: "Ada" }),
      staticRouteContext,
    );

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({
      data: {
        id: "verified-actor-resource",
        displayName: "Ada",
      },
      meta: { requestId: "eval-request" },
    });
  });

  it("rejects an unauthenticated request before the operation", async () => {
    let operationCalls = 0;
    const handler = createHarness(() => {
      operationCalls += 1;
      return Promise.resolve({ id: "resource-1", displayName: "Ada" });
    });

    const response = await handler(
      createRequest({ displayName: "Ada" }, "Bearer invalid"),
      staticRouteContext,
    );

    expect(response.status).toBe(401);
    expect(operationCalls).toBe(0);
  });

  it("rejects invalid input before the operation", async () => {
    let operationCalls = 0;
    const handler = createHarness(() => {
      operationCalls += 1;
      return Promise.resolve({ id: "resource-1", displayName: "Ada" });
    });

    const response = await handler(
      createRequest({ displayName: "" }),
      staticRouteContext,
    );

    expect(response.status).toBe(422);
    expect(operationCalls).toBe(0);
  });

  it("rejects an oversized declared body without consuming or executing it", async () => {
    let operationCalls = 0;
    const handler = createHarness(() => {
      operationCalls += 1;
      return Promise.resolve({ id: "resource-1", displayName: "Ada" });
    });
    const request = createDeclaredOversizedRequest();

    const response = await handler(request, staticRouteContext);

    expect(response.status).toBe(413);
    expect(await response.json()).toMatchObject({
      code: "payload_too_large",
      requestId: "eval-request",
    });
    expect(request.bodyUsed).toBe(false);
    expect(operationCalls).toBe(0);
  });

  it("maps resource authorization failure", async () => {
    const handler = createHarness(() => {
      throw new ApplicationError("forbidden");
    });

    const response = await handler(
      createRequest({ displayName: "Ada" }),
      staticRouteContext,
    );

    expect(response.status).toBe(403);
  });

  it("sanitizes an unexpected failure", async () => {
    const handler = createHarness(() => {
      throw new Error("sensitive persistence detail");
    });

    const response = await handler(
      createRequest({ displayName: "Ada" }),
      staticRouteContext,
    );
    const body = await response.text();

    expect(response.status).toBe(500);
    expect(body).toContain('"code":"internal_error"');
    expect(body).not.toContain("sensitive persistence detail");
  });

  it("validates asynchronous dynamic route params before execution", async () => {
    const resourceId = "550e8400-e29b-41d4-a716-446655440000";
    const routeParametersSchema = z.object({
      resourceId: z.string().uuid(),
    });
    const handler = createAuthenticatedRoute({
      routePattern: "/api/v1/eval-resource/[resourceId]",
      logger: quietLogger,
      authenticate: () =>
        Promise.resolve({
          id: "verified-actor",
          kind: "authenticated",
          permissions: ["resource:read"],
          roles: ["student"],
        }),
      parse: async (_request, routeContext) =>
        parseInput(routeParametersSchema, await routeContext.params),
      execute: (input) => Promise.resolve({ id: input.resourceId }),
    });

    const response = await handler(
      new Request(`https://example.test/api/v1/eval-resource/${resourceId}`),
      {
        params: Promise.resolve({ resourceId }),
      },
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      data: { id: resourceId },
    });
  });
});
