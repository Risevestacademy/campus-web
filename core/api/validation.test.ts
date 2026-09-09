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
