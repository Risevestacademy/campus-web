import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";

import { TEST_ORIGIN } from "@/tests/fixtures/mock-api";
import { withQueryClient } from "@/tests/fixtures/query-client";

import { OwnProfileAction } from "./own-profile-action";

const mockApi = await vi.hoisted(async () => {
  const { startMockApi } = await import("@/tests/fixtures/mock-api");
  return startMockApi();
});
const navigation = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: navigation.refresh }),
}));

const ME_URL = `${TEST_ORIGIN}/api/v1/users/me`;
const profile = {
  id: "u-1",
  email: "ada@campus.local",
  firstName: "Ada",
  lastName: "Lovelace",
  displayName: "Ada L.",
  bio: "Writes notes on engines.",
  phone: null,
  memberships: [
    {
      role: "student",
      cohort: { id: "c-1", name: "Cohort 2026" },
      track: { name: "Backend" },
    },
  ],
};

afterEach(() => {
  mockApi.reset();
  navigation.refresh.mockReset();
});
afterAll(() => mockApi.close());

function renderAction() {
  render(
    withQueryClient(
      <OwnProfileAction cohortId="c-1">
        {({ summary, openEditor }) => (
          <>
            <p>{summary ? `${summary.displayName} · ${summary.place}` : "…"}</p>
            <button type="button" onClick={() => openEditor("profile")}>
              Edit profile
            </button>
            <button type="button" onClick={() => openEditor("character")}>
              Change character
            </button>
          </>
        )}
      </OwnProfileAction>,
    ),
  );
}

async function openEditor(item = "Edit profile") {
  fireEvent.click(screen.getByRole("button", { name: item }));
  return screen.findByRole("dialog", { name: "Profile" });
}

describe("OwnProfileAction", () => {
  it("sums the member up for the control that draws them", async () => {
    mockApi.server.use(http.get(ME_URL, () => HttpResponse.json(profile)));
    renderAction();

    expect(
      await screen.findByText("Ada L. · Backend · Cohort 2026"),
    ).toBeInTheDocument();
  });

  it("opens the editor filled from the profile, with the place read-only", async () => {
    mockApi.server.use(http.get(ME_URL, () => HttpResponse.json(profile)));
    renderAction();
    await screen.findByText("Ada L. · Backend · Cohort 2026");

    const editor = await openEditor();

    expect(
      within(editor).getByRole("tab", { name: "Profile" }),
    ).toHaveAttribute("aria-selected", "true");
    expect(within(editor).getByLabelText(/^Display name/)).toHaveValue(
      "Ada L.",
    );
    expect(within(editor).getByLabelText(/^Bio/)).toHaveValue(
      "Writes notes on engines.",
    );
    expect(within(editor).getByText("Student")).toBeInTheDocument();
    expect(
      within(editor).queryByRole("tab", { name: /Projects/ }),
    ).not.toBeInTheDocument();
  });

  it("saves only what changed, then closes and reads the session again", async () => {
    const sent: unknown[] = [];
    mockApi.server.use(
      http.get(ME_URL, () => HttpResponse.json(profile)),
      http.patch(ME_URL, async ({ request }) => {
        sent.push(await request.json());
        return HttpResponse.json({ ...profile, displayName: "Ada" });
      }),
    );
    renderAction();
    await screen.findByText("Ada L. · Backend · Cohort 2026");
    const editor = await openEditor();

    fireEvent.change(within(editor).getByLabelText(/^Display name/), {
      target: { value: "Ada" },
    });
    fireEvent.click(
      within(editor).getByRole("button", { name: "Save profile" }),
    );

    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "Profile" })).toBeNull();
    });
    expect(sent).toStrictEqual([{ displayName: "Ada" }]);
    expect(navigation.refresh).toHaveBeenCalledOnce();
    expect(screen.getByText("Ada · Backend · Cohort 2026")).toBeInTheDocument();
  });

  it("says when nothing changed, and sends nothing", async () => {
    const patch = vi.fn();
    mockApi.server.use(
      http.get(ME_URL, () => HttpResponse.json(profile)),
      http.patch(ME_URL, patch),
    );
    renderAction();
    await screen.findByText("Ada L. · Backend · Cohort 2026");
    const editor = await openEditor();

    fireEvent.click(
      within(editor).getByRole("button", { name: "Save profile" }),
    );

    expect(
      within(editor).getByText("Change at least one field before saving."),
    ).toBeInTheDocument();
    expect(patch).not.toHaveBeenCalled();
  });

  it("shows a phone it cannot take beside the field, and sends nothing", async () => {
    const patch = vi.fn();
    mockApi.server.use(
      http.get(ME_URL, () => HttpResponse.json(profile)),
      http.patch(ME_URL, patch),
    );
    renderAction();
    await screen.findByText("Ada L. · Backend · Cohort 2026");
    const editor = await openEditor();

    const phone = within(editor).getByLabelText(/^Phone/);
    fireEvent.change(phone, { target: { value: "call me" } });
    fireEvent.click(
      within(editor).getByRole("button", { name: "Save profile" }),
    );

    expect(phone).toHaveAttribute("aria-invalid", "true");
    expect(phone).toHaveAccessibleDescription(/Use digits/);
    expect(patch).not.toHaveBeenCalled();
  });

  it("keeps the editor open and explains a refused save", async () => {
    mockApi.server.use(
      http.get(ME_URL, () => HttpResponse.json(profile)),
      http.patch(ME_URL, () => new HttpResponse(null, { status: 400 })),
    );
    renderAction();
    await screen.findByText("Ada L. · Backend · Cohort 2026");
    const editor = await openEditor();

    fireEvent.change(within(editor).getByLabelText(/^Bio/), {
      target: { value: "A very long bio" },
    });
    fireEvent.click(
      within(editor).getByRole("button", { name: "Save profile" }),
    );

    expect(await within(editor).findByRole("alert")).toHaveTextContent(
      "A field may be too long",
    );
    expect(screen.getByRole("dialog", { name: "Profile" })).toBeInTheDocument();
    expect(navigation.refresh).not.toHaveBeenCalled();
  });

  it("opens straight on the Character tab, which holds nothing yet", async () => {
    mockApi.server.use(http.get(ME_URL, () => HttpResponse.json(profile)));
    renderAction();

    const editor = await openEditor("Change character");

    expect(
      within(editor).getByRole("tab", { name: "Character" }),
    ).toHaveAttribute("aria-selected", "true");
    expect(
      within(editor).getByText("Characters are coming soon."),
    ).toBeVisible();
  });

  it("says when the profile cannot be read", async () => {
    mockApi.server.use(
      http.get(ME_URL, () => new HttpResponse(null, { status: 500 })),
    );
    renderAction();

    const editor = await openEditor();

    expect(await within(editor).findByRole("alert")).toHaveTextContent(
      "We couldn't load your profile.",
    );
  });
});
