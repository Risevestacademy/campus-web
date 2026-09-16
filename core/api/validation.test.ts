// @vitest-environment node

import { describe, expect, it } from "vitest";
import { z } from "zod";

import { ApplicationError } from "./errors";
import { parseInput, parseJsonBody } from "./validation";

const inputSchema = z.object({
  displayName: z.string().min(1, "Display name is required."),
});

describe("parseJsonBody", () => {
  it("accepts a valid JSON media type and returns validated data", async () => {
    const request = new Request("https://example.test/api/profile", {
      method: "POST",
      headers: { "content-type": "application/json; charset=utf-8" },
      body: JSON.stringify({ displayName: "Ada" }),
    });

    await expect(parseJsonBody(request, inputSchema)).resolves.toEqual({
      displayName: "Ada",
    });
  });

  it("rejects an unsupported media type before parsing", async () => {
    const request = new Request("https://example.test/api/profile", {
      method: "POST",
      headers: { "content-type": "text/plain" },
      body: JSON.stringify({ displayName: "Ada" }),
    });

    await expect(parseJsonBody(request, inputSchema)).rejects.toMatchObject({
      code: "unsupported_media_type",
    });
  });

  it("rejects an oversized declared body before reading it", async () => {
    const request = new Request("https://example.test/api/profile", {
      method: "POST",
      headers: {
        "content-length": "5",
        "content-type": "application/json",
      },
      body: JSON.stringify({ displayName: "Ada" }),
    });

    await expect(parseJsonBody(request, inputSchema, 4)).rejects.toMatchObject({
      code: "payload_too_large",
    });
    expect(request.bodyUsed).toBe(false);
  });

  it("rejects malformed JSON", async () => {
    const request = new Request("https://example.test/api/profile", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{",
    });

    await expect(parseJsonBody(request, inputSchema)).rejects.toMatchObject({
      code: "invalid_json",
    });
  });

  it("rejects a body larger than the configured limit", async () => {
    const request = new Request("https://example.test/api/profile", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ displayName: "Ada" }),
    });

    await expect(parseJsonBody(request, inputSchema, 4)).rejects.toMatchObject({
      code: "payload_too_large",
    });
  });

  it("cancels an undeclared body when streamed bytes exceed the limit", async () => {
    const encoder = new TextEncoder();
    const chunks = [
      encoder.encode('{"display'),
      encoder.encode('Name":"Ada"}'),
      encoder.encode("unread"),
    ];
    let chunkIndex = 0;
    let wasCancelled = false;
    const body = new ReadableStream<Uint8Array>(
      {
        cancel: () => {
          wasCancelled = true;
        },
        pull: (controller) => {
          const chunk = chunks[chunkIndex];
          chunkIndex += 1;

          if (chunk) {
            controller.enqueue(chunk);
          } else {
            controller.close();
          }
        },
      },
      { highWaterMark: 0 },
    );
    const request = new Request("https://example.test/api/profile", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
      duplex: "half",
    } as RequestInit & { duplex: "half" });

    await expect(parseJsonBody(request, inputSchema, 10)).rejects.toMatchObject(
      {
        code: "payload_too_large",
      },
    );
    expect(wasCancelled).toBe(true);
  });
});

describe("parseInput", () => {
  it("returns stable field issues for invalid input", () => {
    try {
      parseInput(inputSchema, { displayName: "" });
      throw new Error("Expected input validation to fail.");
    } catch (reason) {
      expect(reason).toBeInstanceOf(ApplicationError);
      expect(reason).toMatchObject({
        code: "validation_failed",
        issues: [
          {
            code: "too_small",
            message: "Display name is required.",
            path: "displayName",
          },
        ],
      });
    }
  });
});
