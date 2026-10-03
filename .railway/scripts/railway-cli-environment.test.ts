// @vitest-environment node

import { describe, expect, it } from "vitest";

import { railwayCliEnvironment } from "./railway-cli-environment";

describe("railwayCliEnvironment", () => {
  it("drops the launcher path in $_ so railway/iac checks the real CLI", () => {
    expect(
      railwayCliEnvironment({ _: "/usr/local/bin/pnpm", PATH: "/usr/bin" }),
    ).not.toHaveProperty("_");
  });

  it("keeps every other variable", () => {
    expect(
      railwayCliEnvironment({
        _: "/usr/local/bin/pnpm",
        HOME: "/Users/aj",
        PATH: "/usr/bin",
      }),
    ).toEqual({ HOME: "/Users/aj", PATH: "/usr/bin" });
  });

  it("leaves the caller's environment untouched", () => {
    const environment = { _: "/usr/local/bin/pnpm", PATH: "/usr/bin" };

    railwayCliEnvironment(environment);

    expect(environment).toHaveProperty("_", "/usr/local/bin/pnpm");
  });
});
