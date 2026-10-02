import { act, render } from "@testing-library/react";
import { http } from "msw";
import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { TEST_ORIGIN } from "@/tests/fixtures/mock-api";
import { withQueryClient } from "@/tests/fixtures/query-client";

import SessionRefreshPage from "./page";

const mockApi = await vi.hoisted(async () => {
  const { startMockApi } = await import("@/tests/fixtures/mock-api");
  return startMockApi();
});

const navigation = vi.hoisted(() => ({ replace: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => navigation }));
vi.mock("server-only", () => ({}));

const refreshed = () =>
  Response.json({
    expiresAt: "2026-10-02T12:15:00.000Z",
    refreshExpiresAt: "2026-11-01T12:00:00.000Z",
  });

async function refreshFrom(returnTo: string | string[] | undefined) {
  mockApi.server.use(
    http.post(`${TEST_ORIGIN}/api/v1/auth/refresh`, refreshed, { once: true }),
  );
  render(
    withQueryClient(
      await SessionRefreshPage({ searchParams: Promise.resolve({ returnTo }) }),
    ),
  );
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });
  return navigation.replace.mock.calls;
}

beforeEach(() => {
  vi.useFakeTimers();
  navigation.replace.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
  mockApi.reset();
});

afterAll(() => {
  mockApi.close();
});

describe("SessionRefreshPage", () => {
  it("returns to the requested Campus deep link", async () => {
    await expect(refreshFrom("/campus/42/rooms?seat=3")).resolves.toEqual([
      ["/campus/42/rooms?seat=3"],
    ]);
  });

  it.each([
    ["an off-site destination", "//attacker.example/campus"],
    ["a non-Campus destination", "/invitation"],
    ["a missing destination", undefined],
  ])("returns to the campus index for %s", async (_, returnTo) => {
    await expect(refreshFrom(returnTo)).resolves.toEqual([["/campus"]]);
  });

  it("uses the first destination when several are supplied", async () => {
    await expect(
      refreshFrom(["/campus/42", "//attacker.example/campus"]),
    ).resolves.toEqual([["/campus/42"]]);
  });
});
