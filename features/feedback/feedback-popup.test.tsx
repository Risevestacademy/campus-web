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

const mockApi = await vi.hoisted(async () => {
  const { startMockApi } = await import("@/tests/fixtures/mock-api");
  return startMockApi();
});

const sideEffects = vi.hoisted(() => [] as string[]);

vi.mock("@/shared/lib/document-navigation", () => ({
  replaceDocument: (href: string) => sideEffects.push(`go ${href}`),
}));

import { FeedbackPopup } from "./feedback-popup";

const FEEDBACK_URL = `${TEST_ORIGIN}/api/v1/feedback`;

function replyReceipt(sent: unknown[] = []) {
  return http.post(FEEDBACK_URL, async ({ request }) => {
    const body = (await request.json()) as { type: string; title: string };
    sent.push(body);
    return HttpResponse.json(
      {
        id: `feedback-${sent.length}`,
        type: body.type,
        title: body.title,
        createdAt: "2026-10-16T12:00:00.000Z",
      },
      { status: 201 },
    );
  });
}

function renderPopup(
  props: Partial<React.ComponentProps<typeof FeedbackPopup>> = {},
) {
  const onClose = vi.fn();

  render(
    withQueryClient(
      <FeedbackPopup
        isOpen
        onClose={onClose}
        cohortId="cohort-1"
        userName="Joseph Okoro"
        {...props}
      />,
    ),
  );

  return { onClose };
}

function fillIn(kind: string, title: string, details = "It happens often.") {
  fireEvent.click(screen.getByRole("button", { name: kind }));
  fireEvent.change(screen.getByLabelText("Title"), {
    target: { value: title },
  });
  fireEvent.change(screen.getByLabelText("Details"), {
    target: { value: details },
  });
}

function send() {
  fireEvent.click(screen.getByRole("button", { name: "Send feedback" }));
}

afterEach(() => {
  mockApi.reset();
  sideEffects.length = 0;
});
afterAll(() => mockApi.close());

describe("FeedbackPopup", () => {
  it("renders nothing while closed", () => {
    renderPopup({ isOpen: false });

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("shows the form beside an empty feedback history", () => {
    renderPopup();

    const dialog = screen.getByRole("dialog", { name: "Feedback" });
    const history = within(dialog).getByRole("region", {
      name: "Feedback history",
    });

    expect(within(history).queryAllByRole("listitem")).toHaveLength(0);
    expect(within(history).getByText(/Nothing sent yet/)).toBeVisible();
    expect(within(dialog).getByLabelText(/Where in Campus/)).toHaveValue("");
    expect(within(dialog).getAllByText("Optional")).toHaveLength(2);
    expect(
      within(dialog).queryByLabelText("Who are you reporting?"),
    ).not.toBeInTheDocument();
    expect(
      within(dialog).getByRole("button", { name: "Report" }),
    ).toBeVisible();
  });

  it("asks for a kind, a title and details before sending", () => {
    renderPopup();

    send();

    expect(
      screen.getByText("Choose what kind of feedback this is."),
    ).toBeVisible();
    expect(screen.getByText("Give your feedback a short title.")).toBeVisible();
    expect(
      screen.getByText("Tell us a little more so we can look into it."),
    ).toBeVisible();
    expect(mockApi.requests).toHaveLength(0);
  });

  it("sends the feedback to campus-api with where it came from", async () => {
    const sent: unknown[] = [];
    mockApi.server.use(replyReceipt(sent));
    renderPopup();

    fillIn("Idea", "Show who's in a pod before knocking");
    fireEvent.change(screen.getByLabelText(/Where in Campus/), {
      target: { value: "Mentor pod 2" },
    });
    send();

    await screen.findByRole("heading", { name: "Thanks, Joseph. We got it" });
    expect(sent).toEqual([
      {
        type: "idea",
        title: "Show who's in a pod before knocking",
        details: "It happens often.",
        about: "Mentor pod 2",
        cohortId: "cohort-1",
        context: { path: "/" },
      },
    ]);
  });

  it("asks who is being reported only for a report, and requires it", async () => {
    const sent: unknown[] = [];
    mockApi.server.use(replyReceipt(sent));
    renderPopup();

    fireEvent.click(screen.getByRole("button", { name: "Report" }));
    expect(screen.getByLabelText("Who are you reporting?")).toBeVisible();

    fillIn("Report", "Unwanted waves");
    send();
    expect(screen.getByText("Tell us who you are reporting.")).toBeVisible();
    expect(mockApi.requests).toHaveLength(0);

    fireEvent.change(screen.getByLabelText("Who are you reporting?"), {
      target: { value: "Ramnan | Ramyil" },
    });
    fireEvent.change(screen.getByLabelText(/Where in Campus/), {
      target: { value: "Main hallway" },
    });
    send();

    await screen.findByRole("button", { name: "Send another" });
    expect(sent).toEqual([
      expect.objectContaining({
        type: "report",
        about: "Ramnan / Ramyil | Main hallway",
      }),
    ]);
    fireEvent.click(screen.getByRole("button", { name: /Unwanted waves/ }));

    expect(screen.getByText("Ramnan | Ramyil")).toBeVisible();
    expect(screen.getByText("Main hallway")).toBeVisible();
  });

  it("hides the field again when another kind is chosen", () => {
    renderPopup();

    fireEvent.click(screen.getByRole("button", { name: "Report" }));
    fireEvent.click(screen.getByRole("button", { name: "Bug" }));

    expect(
      screen.queryByLabelText("Who are you reporting?"),
    ).not.toBeInTheDocument();
  });

  it("confirms by first name and adds the feedback to the history", async () => {
    mockApi.server.use(replyReceipt());
    renderPopup();

    fillIn("Idea", "Show who's in a pod before knocking");
    send();

    expect(
      await screen.findByRole("heading", { name: "Thanks, Joseph. We got it" }),
    ).toBeVisible();
    expect(
      screen.getByText(/Your idea “Show who's in a pod before knocking”/),
    ).toBeVisible();

    const history = screen.getByRole("region", { name: "Feedback history" });
    const items = within(history).getAllByRole("listitem");

    expect(items).toHaveLength(1);
    expect(items[0]).toHaveTextContent("Show who's in a pod before knocking");
    expect(items[0]).toHaveTextContent("just now");
    expect(within(items[0]!).getByRole("button")).toHaveAttribute(
      "aria-current",
      "true",
    );
  });

  it("shows a history item's details in place of the form and highlights it", async () => {
    mockApi.server.use(replyReceipt());
    renderPopup();

    fillIn("Bug", "Mic cuts out", "It drops after a minute.");
    send();
    await screen.findByRole("button", { name: "Send another" });

    fireEvent.click(screen.getByRole("button", { name: /Mic cuts out/ }));

    expect(
      screen.getByRole("heading", { level: 2, name: "Mic cuts out" }),
    ).toBeVisible();
    expect(screen.getByText("It drops after a minute.")).toBeVisible();
    expect(screen.queryByLabelText("Title")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "New feedback" }));

    expect(screen.getByLabelText("Title")).toHaveValue("");
  });

  it("returns to an empty form from Send another", async () => {
    mockApi.server.use(replyReceipt());
    renderPopup();

    fillIn("Bug", "Mic cuts out");
    send();
    fireEvent.click(
      await screen.findByRole("button", { name: "Send another" }),
    );

    expect(screen.getByLabelText("Title")).toHaveValue("");
  });

  it("sends once however many times Send is pressed", async () => {
    mockApi.server.use(replyReceipt());
    renderPopup();

    fillIn("Bug", "Mic cuts out");
    send();
    send();

    await screen.findByRole("button", { name: "Send another" });
    expect(
      mockApi.requests.filter((request) => request.method === "POST"),
    ).toHaveLength(1);
  });

  it.each([
    [400, "We couldn't send that. Check the fields and try again."],
    [403, "You don't have permission to send feedback right now."],
    [
      429,
      "You've sent a lot of feedback in the last hour. Please try again later.",
    ],
    [
      500,
      "We couldn't send your feedback. Check your connection and try again.",
    ],
  ])("explains a %s and keeps what was typed", async (status, message) => {
    mockApi.server.use(
      http.post(FEEDBACK_URL, () => new Response(null, { status })),
    );
    renderPopup();

    fillIn("Bug", "Mic cuts out");
    send();

    expect(await screen.findByText(message)).toBeVisible();
    expect(screen.getByLabelText("Title")).toHaveValue("Mic cuts out");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it.each([
    ["an empty body", {}],
    ["an empty id", { id: "" }],
  ])(
    "explains a 201 with %s as unavailable and adds nothing to the history",
    async (_name, body) => {
      mockApi.server.use(
        http.post(FEEDBACK_URL, () => Response.json(body, { status: 201 })),
      );
      renderPopup();

      fillIn("Bug", "Mic cuts out");
      send();

      expect(
        await screen.findByText(
          "We couldn't send your feedback. Check your connection and try again.",
        ),
      ).toBeVisible();
      expect(screen.getByLabelText("Title")).toHaveValue("Mic cuts out");

      const history = screen.getByRole("region", { name: "Feedback history" });
      expect(within(history).queryAllByRole("listitem")).toHaveLength(0);
      expect(within(history).getByText(/Nothing sent yet/)).toBeVisible();
    },
  );

  it("goes to sign-in when the session has ended", async () => {
    mockApi.server.use(
      http.post(FEEDBACK_URL, () => new Response(null, { status: 401 })),
    );
    renderPopup();

    fillIn("Bug", "Mic cuts out");
    send();

    await waitFor(() => expect(sideEffects).toEqual(["go /sign-in"]));
  });

  it("closes from Cancel, the close button and Back to campus", async () => {
    mockApi.server.use(replyReceipt());
    const { onClose } = renderPopup();

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    fireEvent.click(screen.getByRole("button", { name: "Close feedback" }));
    fillIn("Idea", "Dark mode");
    send();
    fireEvent.click(
      await screen.findByRole("button", { name: "Back to campus" }),
    );

    expect(onClose).toHaveBeenCalledTimes(3);
  });

  it("rejects a screenshot that is not an image", () => {
    renderPopup();

    fireEvent.change(screen.getByLabelText("Screenshot file"), {
      target: {
        files: [new File(["x"], "notes.txt", { type: "text/plain" })],
      },
    });

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Use a PNG, JPEG, WebP or GIF image.",
    );
  });

  it("pastes the first supported image when the clipboard lists a TIFF first", async () => {
    renderPopup();

    fireEvent.paste(screen.getByLabelText("Title"), {
      clipboardData: {
        types: ["Files"],
        files: [
          new File(["x"], "pod.tiff", { type: "image/tiff" }),
          new File(["x"], "pod.png", { type: "image/png" }),
        ],
      },
    });

    expect(await screen.findByAltText("Screenshot preview")).toBeVisible();
    expect(screen.getByText("pod.png")).toBeVisible();
  });

  it("previews the first supported image when files are dropped", async () => {
    renderPopup();

    fireEvent.drop(screen.getByRole("button", { name: /Add a screenshot/ }), {
      dataTransfer: {
        files: [
          new File(["x"], "pod.tiff", { type: "image/tiff" }),
          new File(["x"], "pod.png", { type: "image/png" }),
        ],
      },
    });

    expect(await screen.findByAltText("Screenshot preview")).toBeVisible();
    expect(screen.getByText("pod.png")).toBeVisible();
  });

  it("explains which images work when a non-image file is dropped", () => {
    renderPopup();

    fireEvent.drop(screen.getByRole("button", { name: /Add a screenshot/ }), {
      dataTransfer: {
        files: [new File(["x"], "notes.txt", { type: "text/plain" })],
      },
    });

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Use a PNG, JPEG, WebP or GIF image.",
    );
  });

  it("pastes copied cells into a text field as text, not as an image", () => {
    renderPopup();

    const pastedAsImage = !fireEvent.paste(screen.getByLabelText("Title"), {
      clipboardData: {
        types: ["text/plain", "Files"],
        files: [
          new File(["x"], "cells.tiff", { type: "image/tiff" }),
          new File(["x"], "cells.png", { type: "image/png" }),
        ],
        getData: () => "A1",
      },
    });

    expect(pastedAsImage).toBe(false);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("explains which images work when only an unsupported one is pasted", () => {
    renderPopup();

    fireEvent.paste(screen.getByLabelText("Title"), {
      clipboardData: {
        types: ["Files"],
        files: [new File(["x"], "pod.heic", { type: "image/heic" })],
      },
    });

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Use a PNG, JPEG, WebP or GIF image.",
    );
  });

  it("previews a chosen screenshot and lets it be removed", async () => {
    renderPopup();

    fireEvent.change(screen.getByLabelText("Screenshot file"), {
      target: {
        files: [new File(["x"], "pod.png", { type: "image/png" })],
      },
    });

    expect(await screen.findByAltText("Screenshot preview")).toBeVisible();
    expect(screen.getByText("pod.png")).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Remove screenshot" }));

    expect(screen.getByText("Add a screenshot")).toBeVisible();
  });
});
