import { vi } from "vitest";

import type { CampusRuntime } from "../game/campus-runtime";

export function fakeCampusRuntime(
  overrides: Partial<CampusRuntime> = {},
): CampusRuntime {
  return {
    holdsMap: vi.fn(() => false),
    start: vi.fn(async () => ({ stop: vi.fn() })),
    ...overrides,
  };
}
