import { fireEvent, render, screen } from "@testing-library/react";
import { http } from "msw";
import { type ReactNode, useState } from "react";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";

import { useRefreshSession } from "@/shared/lib/session-refresh";
import { type Reply, TEST_ORIGIN } from "@/tests/fixtures/mock-api";

import { SessionRefreshProvider } from "./session-refresh-provider";

const mockApi = await vi.hoisted(async () => {
  const { startMockApi } = await import("@/tests/fixtures/mock-api");
  return startMockApi();
});

afterEach(() => mockApi.reset());
afterAll(() => mockApi.close());

const REFRESH_URL = `${TEST_ORIGIN}/api/v1/auth/refresh`;

function RefreshProbe() {
  const refreshSession = useRefreshSession();
  const [result, setResult] = useState("not asked");

  async function refresh() {
    setResult(String(await refreshSession()));
  }

  return (
    <>
      <button onClick={() => void refresh()} type="button">
        Refresh
      </button>
      <output aria-label="Refreshed">{result}</output>
    </>
  );
}

function refreshThrough(tree: ReactNode) {
  render(tree);
  fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
}

describe("SessionRefreshProvider", () => {
  it.each<[string, string, Reply]>([
    [
      "a renewed session",
      "true",
      () =>
        Response.json({
          expiresAt: "2026-10-17T12:15:00.000Z",
          refreshExpiresAt: "2026-11-16T12:00:00.000Z",
        }),
    ],
    ["an expired session", "false", () => new Response(null, { status: 401 })],
    ["a failed refresh", "false", () => new Response(null, { status: 503 })],
  ])("answers %s as %s", async (_, answer, reply) => {
    mockApi.server.use(http.post(REFRESH_URL, reply));

    refreshThrough(
      <SessionRefreshProvider>
        <RefreshProbe />
      </SessionRefreshProvider>,
    );

    await vi.waitFor(() =>
      expect(screen.getByLabelText("Refreshed")).toHaveTextContent(answer),
    );
  });

  it("answers false where nothing provides a refresher", async () => {
    refreshThrough(<RefreshProbe />);

    await vi.waitFor(() =>
      expect(screen.getByLabelText("Refreshed")).toHaveTextContent("false"),
    );
    expect(mockApi.requests).toHaveLength(0);
  });
});
