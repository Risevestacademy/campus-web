import { describe, expect, it } from "vitest";

import {
  isPublishedRoute,
  matchesRouteTemplate,
  PUBLISHED_ROUTE_TEMPLATES,
} from "./upstream-routes";

function withSampleParameters(template: string): string[] {
  return template
    .split("/")
    .slice(1)
    .map((segment) => segment.replace(/^\{(\w+)\}$/, "sample-$1"));
}

describe("isPublishedRoute", () => {
  it.each(PUBLISHED_ROUTE_TEMPLATES)("accepts %s", (template) => {
    expect(isPublishedRoute(withSampleParameters(template))).toBe(true);
  });

  it.each([
    [["v1"]],
    [["v1", "auth", "google", "callback"]],
    [["v1", "cohorts", "c-1", "members", "u-1", "graduate"]],
    [["v1", "tracks", "a/b"]],
  ])("accepts %j", (path) => {
    expect(isPublishedRoute(path)).toBe(true);
  });

  it.each([
    ["an empty path", []],
    ["an unknown route", ["v1", "profile"]],
    ["an extra segment", ["v1", "health", "x"]],
    ["a missing segment", ["v1", "invites", "i-1"]],
    ["an empty parameter", ["v1", "tracks", ""]],
    ["a dot parameter", ["v1", "tracks", "."]],
    ["a dot-dot parameter", ["v1", "tracks", ".."]],
    ["a dot-dot literal", ["v1", "..", "v1", "health"]],
    ["a different case", ["V1", "health"]],
  ])("rejects %s", (_case, path) => {
    expect(isPublishedRoute(path)).toBe(false);
  });
});

describe("matchesRouteTemplate", () => {
  it.each([
    ["/v1/exports/{id}.csv", ["v1", "exports", "42.csv"]],
    ["/v1/files/{path*}", ["v1", "files", "a"]],
  ])("fails closed on the unknown segment shape in %s", (template, path) => {
    expect(matchesRouteTemplate(template, path)).toBe(false);
  });
});
