import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { toast, Toaster } from "@/shared/ui/toast";
import { withQueryClient } from "@/tests/fixtures/query-client";

import type { InviteOptions } from "../types/invite.types";
import { BulkInviteDialog } from "./bulk-invite-dialog";

// jsdom's FormData cannot be serialized by Node's fetch, so the upload itself
// is covered where it can run: the adapter test, and a real browser in the
// e2e spec. Here the adapter answers what campus-api would.
const importInvites = vi.hoisted(() => vi.fn());
vi.mock("../services/invite-api.adapter", () => ({ importInvites }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: () => {} }),
}));
vi.mock("@/shared/lib/document-navigation", () => ({
  replaceDocument: () => {},
}));

const OPTIONS: InviteOptions = {
  tracks: {
    kind: "loaded",
    options: [
      { id: "ct-1", name: "Backend", code: "BE" },
      { id: "ct-2", name: "Mobile", code: "MOB" },
    ],
  },
  groups: { kind: "loaded", options: [] },
};
const VALID_CSV =
  "email,role,track\nada@campus.local,student,BE\ngrace@campus.local,professor,\n";

function renderDialog(options: InviteOptions = OPTIONS) {
  render(
    <>
      {withQueryClient(<BulkInviteDialog cohortId="c-1" options={options} />)}
      <Toaster />
    </>,
  );
}

async function openDialog() {
  fireEvent.click(screen.getByRole("button", { name: "Bulk invite" }));
  return screen.findByRole("dialog");
}

function trigger() {
  return screen.getByText("Bulk invite", { selector: "button" });
}

async function choose(contents: string, name = "cohort2.csv") {
  const input = screen.getByLabelText(/Choose a CSV file/);
  const file = new File([contents], name, { type: "text/csv" });
  fireEvent.change(input, { target: { files: [file] } });
  await waitFor(() =>
    expect(
      screen.queryByRole("alert") ??
        screen.queryByRole("button", { name: /^Send \d/ }),
    ).not.toBeNull(),
  );
}

function sendButton() {
  return screen.getByRole("button", { name: /^Send/ });
}

const IMPORTED = (
  rows: { line: number; email: string; reason?: string }[],
  invited: number,
) => ({
  kind: "imported" as const,
  total: invited + rows.length,
  invited,
  notEmailed: 0,
  failed: rows.map(({ line, email, reason }) => ({
    line,
    email,
    reason: reason ?? "Not invited.",
  })),
});

afterEach(() => {
  cleanup();
  toast.close();
  importInvites.mockReset();
});

describe("Bulk invite", () => {
  it("asks for a file, names the columns, and offers the template with a track code from this cohort", async () => {
    renderDialog();
    await openDialog();

    expect(screen.getByLabelText(/Choose a CSV file/)).toBeInTheDocument();
    expect(screen.getByText(/Columns: email, role, track/)).toBeVisible();
    const template = screen.getByRole("link", { name: "Download template" });
    expect(template).toHaveAttribute("download", "invite-template.csv");
    expect(decodeURIComponent(template.getAttribute("href") ?? "")).toContain(
      "ada@example.com,student,BE",
    );
    expect(
      screen.getByText(
        "Track codes in this cohort: BE (Backend), MOB (Mobile)",
      ),
    ).toBeVisible();
    expect(sendButton()).toBeDisabled();
  });

  it("still offers the template when the tracks could not be read", async () => {
    renderDialog({ tracks: { kind: "unavailable" }, groups: OPTIONS.groups });
    await openDialog();

    expect(
      screen.getByRole("link", { name: "Download template" }),
    ).toBeVisible();
    expect(
      screen.queryByText(/Track codes in this cohort/),
    ).not.toBeInTheDocument();
  });

  it("names the problem with a file that cannot be sent, and sends nothing", async () => {
    renderDialog();
    await openDialog();

    await choose("email,role\na@c.io,student", "cohort.txt");
    expect(screen.getByRole("alert")).toHaveTextContent("Choose a .csv file.");
    expect(sendButton()).toBeDisabled();

    await choose("name,age\nada,3\n");
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Missing: email, role",
      ),
    );
    expect(importInvites).not.toHaveBeenCalled();
  });

  it("counts the rows of a good file on the button and in the header", async () => {
    renderDialog();
    await openDialog();

    await choose(VALID_CSV);

    expect(screen.getByText("cohort2.csv · 2 rows")).toBeVisible();
    expect(sendButton()).toHaveTextContent("Send 2 invites");
    expect(sendButton()).toBeEnabled();
  });
});

describe("sending a file", () => {
  it("uploads the file once with the cohort, however often the button is pressed, then closes", async () => {
    importInvites.mockResolvedValue(IMPORTED([], 2));
    renderDialog();
    await openDialog();
    await choose(VALID_CSV);

    fireEvent.click(sendButton());
    fireEvent.click(sendButton());

    expect(await screen.findByText("2 invites sent")).toBeVisible();
    expect(importInvites).toHaveBeenCalledTimes(1);
    const [, cohortId, file] = importInvites.mock.calls[0] as [
      unknown,
      string,
      File,
    ];
    expect(cohortId).toBe("c-1");
    expect(await file.text()).toBe(VALID_CSV);
    await waitFor(() =>
      expect(trigger()).toHaveAttribute("aria-expanded", "false"),
    );
  });

  it("lists the rows that were not invited, with why", async () => {
    importInvites.mockResolvedValue(
      IMPORTED(
        [
          {
            line: 3,
            email: "grace@campus.local",
            reason: "A pending invite already exists for grace@campus.local",
          },
        ],
        1,
      ),
    );
    renderDialog();
    const dialog = await openDialog();
    await choose(VALID_CSV);

    fireEvent.click(sendButton());

    const failed = await screen.findByRole("heading", {
      name: "These rows were not invited",
    });
    const section = within(failed.closest("section") as HTMLElement);
    expect(section.getByText("Row 3")).toBeVisible();
    expect(
      section.getByText(
        "A pending invite already exists for grace@campus.local",
      ),
    ).toBeVisible();
    expect(within(dialog).getByText("Invited")).toBeVisible();
    expect(await screen.findByRole("status")).toHaveTextContent(
      "1 invite sent, 1 not sent",
    );
    expect(trigger()).toHaveAttribute("aria-expanded", "true");
  });

  it("goes back to choosing a file after a partial result", async () => {
    importInvites.mockResolvedValue(
      IMPORTED(
        [{ line: 2, email: "ada@campus.local", reason: "Unknown track" }],
        0,
      ),
    );
    renderDialog();
    await openDialog();
    await choose(VALID_CSV);
    fireEvent.click(sendButton());
    await screen.findByText("Unknown track");

    fireEvent.click(
      screen.getByRole("button", { name: "Upload another file" }),
    );

    expect(screen.getByLabelText(/Choose a CSV file/)).toBeInTheDocument();
    expect(sendButton()).toBeDisabled();
  });

  it.each([
    ["unreadable", /couldn't read this file/],
    ["forbidden", /no longer have permission/],
    ["rate-limited", /Too many invites at once/],
    ["unavailable", /couldn't send this file/],
  ])(
    "explains %s and keeps the file for another try",
    async (problem, message) => {
      importInvites.mockResolvedValue({ kind: "problem", problem });
      renderDialog();
      await openDialog();
      await choose(VALID_CSV);

      fireEvent.click(sendButton());

      expect(await screen.findByRole("alert")).toHaveTextContent(message);
      expect(sendButton()).toBeEnabled();
    },
  );
});
