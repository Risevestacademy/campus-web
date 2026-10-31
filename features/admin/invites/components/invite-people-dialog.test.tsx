import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { http } from "msw";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";

import { toast, Toaster } from "@/shared/ui/toast";
import { TEST_ORIGIN } from "@/tests/fixtures/mock-api";
import { withQueryClient } from "@/tests/fixtures/query-client";

import type { InviteOptions, InviteRequest } from "../types/invite.types";
import { InvitePeopleDialog } from "./invite-people-dialog";

const mockApi = await vi.hoisted(async () => {
  const { startMockApi } = await import("@/tests/fixtures/mock-api");
  return startMockApi();
});

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: () => {} }),
}));
vi.mock("@/shared/lib/document-navigation", () => ({
  replaceDocument: () => {},
}));

const INVITES_URL = `${TEST_ORIGIN}/api/v1/invites`;
const OPTIONS: InviteOptions = {
  tracks: {
    kind: "loaded",
    options: [
      { id: "ct-1", name: "Backend", code: "BE" },
      { id: "ct-2", name: "Mobile", code: "MOB" },
    ],
  },
  groups: {
    kind: "loaded",
    options: [{ id: "g-1", name: "Pod C", mentorName: "Catherine" }],
  },
};

function renderDialog(options: InviteOptions = OPTIONS) {
  render(
    <>
      {withQueryClient(<InvitePeopleDialog cohortId="c-1" options={options} />)}
      <Toaster />
    </>,
  );
}

async function openDialog() {
  fireEvent.click(screen.getByRole("button", { name: "Invite people" }));
  return screen.findByRole("dialog");
}

// The popup stays mounted while it animates out, which jsdom never finishes,
// so "closed" is read from its trigger.
function trigger() {
  return screen.getByText("Invite people", { selector: "button" });
}

function emailsField() {
  return screen.getByRole("textbox", { name: "Emails" });
}

function paste(text: string) {
  fireEvent.paste(emailsField(), { clipboardData: { getData: () => text } });
}

function field(name: RegExp) {
  return screen.getByRole("combobox", { name });
}

function choose(name: RegExp, value: string) {
  fireEvent.change(field(name), { target: { value } });
}

function sendButton() {
  return screen.getByRole("button", { name: /^Send/ });
}

function recordInvites(reply: (body: InviteRequest) => Response) {
  const bodies: InviteRequest[] = [];
  mockApi.server.use(
    http.post(INVITES_URL, async ({ request }) => {
      const body = (await request.json()) as InviteRequest;
      bodies.push(body);
      return reply(body);
    }),
  );
  return bodies;
}

const CREATED = () => Response.json({ emailStatus: "sent" }, { status: 201 });

afterEach(() => {
  cleanup();
  toast.close();
  mockApi.reset();
});
afterAll(() => mockApi.close());

describe("Invite people", () => {
  it("asks for emails, role, track and group, and for no cohort or note", async () => {
    renderDialog();
    await openDialog();

    expect(emailsField()).toBeVisible();
    expect(field(/^Role/)).toBeVisible();
    expect(field(/^Track/)).toBeVisible();
    expect(field(/^Mentorship group/)).toBeVisible();
    expect(
      screen.queryByRole("combobox", { name: /Cohort/ }),
    ).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Personal note/i)).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Preview email/i }),
    ).not.toBeInTheDocument();
  });

  it("offers student, professor, mentor and admin, and no guest", async () => {
    renderDialog();
    await openDialog();

    expect(
      within(field(/^Role/))
        .getAllByRole("option")
        .map((option) => option.textContent),
    ).toEqual(["Student", "Professor", "Mentor", "Admin"]);
  });

  it("labels each group with its mentor", async () => {
    renderDialog();
    await openDialog();

    expect(
      within(field(/^Mentorship group/)).getByRole("option", {
        name: "Pod C · Catherine",
      }),
    ).toBeInTheDocument();
  });
});

describe("which fields each role shows", () => {
  it.each([
    ["student", true, true],
    ["professor", true, false],
    ["mentor", true, false],
    ["admin", false, false],
  ])("%s: track shown %s, group shown %s", async (role, track, group) => {
    renderDialog();
    await openDialog();

    choose(/^Role/, role);

    expect(field(/^Role/)).toBeVisible();
    for (const [name, shown] of [
      [/^Track/, track],
      [/^Mentorship group/, group],
    ] as const) {
      const control = screen.queryByRole("combobox", { name });
      if (shown) expect(control).toBeVisible();
      else expect(control).not.toBeInTheDocument();
    }
  });

  it("keeps the track and drops the group when a student becomes a mentor", async () => {
    const bodies = recordInvites(CREATED);
    renderDialog();
    await openDialog();
    paste("ada@campus.local");
    choose(/^Track/, "ct-1");
    choose(/^Mentorship group/, "g-1");

    choose(/^Role/, "mentor");
    fireEvent.click(sendButton());

    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(bodies[0]).toEqual({
      email: "ada@campus.local",
      cohortId: "c-1",
      cohortRole: "mentor",
      cohortTrackId: "ct-1",
    });
  });

  it("says why an admin has no placement", async () => {
    renderDialog();
    await openDialog();

    choose(/^Role/, "admin");

    expect(screen.getByText(/not placed in a cohort/i)).toBeVisible();
  });

  it("disables a field whose options could not be loaded, and says so", async () => {
    renderDialog({
      tracks: { kind: "unavailable" },
      groups: { kind: "unavailable" },
    });
    await openDialog();

    expect(field(/^Track/).hasAttribute("disabled")).toBe(true);
    expect(screen.getByText("We couldn't load the tracks.")).toBeVisible();
    expect(screen.getByText("We couldn't load the groups.")).toBeVisible();
  });
});

describe("the email field", () => {
  it("turns several pasted addresses into chips and counts them on the button", async () => {
    renderDialog();
    await openDialog();

    paste("ada@campus.local, grace@campus.local\nlin@campus.local");

    for (const email of [
      "ada@campus.local",
      "grace@campus.local",
      "lin@campus.local",
    ]) {
      expect(
        screen.getByRole("button", { name: `Remove ${email}` }),
      ).toBeVisible();
    }
    expect(sendButton()).toHaveTextContent("Send 3 invites");
  });

  it("makes a chip when a comma or space ends an address, or on Enter", async () => {
    renderDialog();
    await openDialog();

    fireEvent.change(emailsField(), { target: { value: "ada@campus.local," } });
    fireEvent.change(emailsField(), {
      target: { value: "grace@campus.local" },
    });
    fireEvent.keyDown(emailsField(), { key: "Enter" });

    expect(
      screen.getByRole("button", { name: "Remove ada@campus.local" }),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Remove grace@campus.local" }),
    ).toBeVisible();
  });

  it("removes a chip with its button or with Backspace, and counts an address once", async () => {
    renderDialog();
    await openDialog();
    paste("ada@campus.local, ada@campus.local, grace@campus.local");
    expect(sendButton()).toHaveTextContent("Send 2 invites");

    fireEvent.click(
      screen.getByRole("button", { name: "Remove ada@campus.local" }),
    );
    expect(sendButton()).toHaveTextContent("Send invite");

    fireEvent.keyDown(emailsField(), { key: "Backspace" });
    expect(
      screen.queryByRole("button", { name: /^Remove/ }),
    ).not.toBeInTheDocument();
  });
});

describe("sending", () => {
  it("sends nothing without an address, with an incomplete one, or for a student with no track", async () => {
    const bodies = recordInvites(CREATED);
    renderDialog();
    await openDialog();

    fireEvent.click(sendButton());
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Add at least one email.",
    );

    paste("kemi.bello@gmail");
    fireEvent.click(sendButton());
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Fix or remove the highlighted addresses.",
      ),
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Remove kemi.bello@gmail" }),
    );
    paste("ada@campus.local");
    fireEvent.click(sendButton());
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("Choose a track."),
    );

    expect(bodies).toEqual([]);
  });

  it("sends a student's placement once per address, however often the button is pressed, then closes", async () => {
    const bodies = recordInvites(CREATED);
    renderDialog();
    await openDialog();
    paste("ada@campus.local, grace@campus.local");
    choose(/^Track/, "ct-1");
    choose(/^Mentorship group/, "g-1");

    fireEvent.click(sendButton());
    fireEvent.click(sendButton());

    expect(await screen.findByText("2 invites sent")).toBeVisible();
    expect(bodies).toEqual([
      {
        email: "ada@campus.local",
        cohortId: "c-1",
        cohortRole: "student",
        cohortTrackId: "ct-1",
        mentorshipGroupId: "g-1",
      },
      {
        email: "grace@campus.local",
        cohortId: "c-1",
        cohortRole: "student",
        cohortTrackId: "ct-1",
        mentorshipGroupId: "g-1",
      },
    ]);
    await waitFor(() =>
      expect(trigger()).toHaveAttribute("aria-expanded", "false"),
    );
  });

  it("sends a professor with a track and no group", async () => {
    const bodies = recordInvites(CREATED);
    renderDialog();
    await openDialog();
    paste("ada@campus.local");
    choose(/^Role/, "professor");
    choose(/^Track/, "ct-2");

    fireEvent.click(sendButton());

    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(bodies[0]).toEqual({
      email: "ada@campus.local",
      cohortId: "c-1",
      cohortRole: "professor",
      cohortTrackId: "ct-2",
    });
  });

  it("sends an admin with no cohort", async () => {
    const bodies = recordInvites(CREATED);
    renderDialog();
    await openDialog();
    paste("ada@campus.local");
    choose(/^Role/, "admin");

    fireEvent.click(sendButton());

    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(bodies[0]).toEqual({
      email: "ada@campus.local",
      systemRole: "admin",
    });
  });

  it("keeps only the addresses that did not go, with the reason, and sends only those next", async () => {
    let refuse = true;
    const bodies = recordInvites(({ email }) =>
      email === "grace@campus.local" && refuse
        ? Response.json({ error: { code: "CONFLICT" } }, { status: 409 })
        : CREATED(),
    );
    renderDialog();
    const dialog = await openDialog();
    paste("ada@campus.local, grace@campus.local");
    choose(/^Track/, "ct-1");

    fireEvent.click(sendButton());

    expect(
      await screen.findByText(/Already has a pending invite/),
    ).toBeVisible();
    expect(dialog).toBeVisible();
    expect(trigger()).toHaveAttribute("aria-expanded", "true");
    expect(
      screen.queryByRole("button", { name: "Remove ada@campus.local" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Remove grace@campus.local" }),
    ).toBeVisible();
    expect(await screen.findByText("1 invite sent, 1 not sent")).toBeVisible();

    refuse = false;
    fireEvent.click(sendButton());
    await waitFor(() => expect(bodies).toHaveLength(3));
    expect(bodies[2]?.email).toBe("grace@campus.local");
  });

  it("still says which invites were created without an email when another address failed", async () => {
    recordInvites(({ email }) =>
      email === "grace@campus.local"
        ? Response.json({ error: { code: "CONFLICT" } }, { status: 409 })
        : Response.json({ emailStatus: "disabled" }, { status: 201 }),
    );
    renderDialog();
    await openDialog();
    paste("ada@campus.local, grace@campus.local");
    choose(/^Track/, "ct-1");

    fireEvent.click(sendButton());

    expect(await screen.findByText("1 invite sent, 1 not sent")).toBeVisible();
    expect(
      screen.getByText(
        /1 created without an email: resend those from the list/,
      ),
    ).toBeVisible();
  });

  it("warns when invites were made but their emails did not go out", async () => {
    recordInvites(() =>
      Response.json({ emailStatus: "failed" }, { status: 201 }),
    );
    renderDialog();
    await openDialog();
    paste("ada@campus.local");
    choose(/^Track/, "ct-1");

    fireEvent.click(sendButton());

    expect(
      await screen.findByText("1 invite created, 1 without an email"),
    ).toBeVisible();
  });
});
