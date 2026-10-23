import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";

import { FeedbackPopup } from "@/features/feedback";
import { TEST_ORIGIN } from "@/tests/fixtures/mock-api";
import { withQueryClient } from "@/tests/fixtures/query-client";

const mockApi = await vi.hoisted(async () => {
  const { startMockApi } = await import("@/tests/fixtures/mock-api");
  return startMockApi();
});

const navigations = vi.hoisted(() => [] as string[]);

vi.mock("@/shared/lib/document-navigation", () => ({
  replaceDocument: (href: string) => {
    navigations.push(href);
  },
}));

const FEEDBACK_URL = `${TEST_ORIGIN}/api/v1/feedback`;
const FORMAT_MESSAGE = "Use a PNG, JPEG, WebP or GIF image.";
const SIZE_MESSAGE = "Keep the image under 5 MB.";
const FIVE_MB = 5 * 1024 * 1024;

type Sent = Record<string, unknown>;

function accept(sent: Sent[]) {
  mockApi.server.use(
    http.post(FEEDBACK_URL, async ({ request }) => {
      const body = (await request.json()) as Sent;
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
    }),
  );
}

function renderPopup() {
  render(
    withQueryClient(
      <FeedbackPopup
        isOpen
        onClose={() => {}}
        cohortId="cohort-1"
        userName="Joseph Okoro"
      />,
    ),
  );
}

interface Entry {
  kind?: string;
  title?: string;
  details?: string;
  who?: string;
  where?: string;
}

function fillIn({ kind, title, details, who, where }: Entry) {
  if (kind) fireEvent.click(screen.getByRole("button", { name: kind }));
  if (title !== undefined) {
    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: title },
    });
  }
  if (details !== undefined) {
    fireEvent.change(screen.getByLabelText("Details"), {
      target: { value: details },
    });
  }
  if (who !== undefined) {
    fireEvent.change(screen.getByLabelText("Who are you reporting?"), {
      target: { value: who },
    });
  }
  if (where !== undefined) {
    fireEvent.change(screen.getByLabelText(/Where in Campus/), {
      target: { value: where },
    });
  }
}

function send() {
  fireEvent.click(screen.getByRole("button", { name: "Send feedback" }));
}

function feedbackPosts() {
  return mockApi.requests.filter(
    (request) => request.method === "POST" && request.url === FEEDBACK_URL,
  );
}

const image = (name: string, type: string, size = 1) =>
  new File([new Uint8Array(size)], name, { type });

interface ScreenshotCase {
  name: string;
  deliver: () => void;
  outcome: { previews: string } | { refuses: string } | "nothing";
}

const SCREENSHOTS: readonly ScreenshotCase[] = [
  {
    name: "choosing a PNG previews it",
    deliver: () =>
      fireEvent.change(screen.getByLabelText("Screenshot file"), {
        target: { files: [image("pod.png", "image/png")] },
      }),
    outcome: { previews: "pod.png" },
  },
  {
    name: "pasting a clipboard that lists a TIFF before a PNG picks the PNG",
    deliver: () =>
      fireEvent.paste(screen.getByLabelText("Title"), {
        clipboardData: {
          types: ["Files"],
          files: [
            image("pod.tiff", "image/tiff"),
            image("pod.png", "image/png"),
          ],
        },
      }),
    outcome: { previews: "pod.png" },
  },
  {
    name: "dropping a TIFF before a PNG picks the PNG",
    deliver: () =>
      fireEvent.drop(screen.getByRole("button", { name: /Add a screenshot/ }), {
        dataTransfer: {
          files: [
            image("pod.tiff", "image/tiff"),
            image("pod.png", "image/png"),
          ],
        },
      }),
    outcome: { previews: "pod.png" },
  },
  {
    name: "pasting only a HEIC image explains which images work",
    deliver: () =>
      fireEvent.paste(screen.getByLabelText("Title"), {
        clipboardData: {
          types: ["Files"],
          files: [image("pod.heic", "image/heic")],
        },
      }),
    outcome: { refuses: FORMAT_MESSAGE },
  },
  {
    name: "choosing a non-image file explains which images work",
    deliver: () =>
      fireEvent.change(screen.getByLabelText("Screenshot file"), {
        target: { files: [image("notes.txt", "text/plain")] },
      }),
    outcome: { refuses: FORMAT_MESSAGE },
  },
  {
    name: "dropping a non-image file explains which images work",
    deliver: () =>
      fireEvent.drop(screen.getByRole("button", { name: /Add a screenshot/ }), {
        dataTransfer: { files: [image("notes.txt", "text/plain")] },
      }),
    outcome: { refuses: FORMAT_MESSAGE },
  },
  {
    name: "an image just over 5 MB is refused",
    deliver: () =>
      fireEvent.change(screen.getByLabelText("Screenshot file"), {
        target: { files: [image("big.png", "image/png", FIVE_MB + 1)] },
      }),
    outcome: { refuses: SIZE_MESSAGE },
  },
  {
    name: "an image of exactly 5 MB is accepted",
    deliver: () =>
      fireEvent.change(screen.getByLabelText("Screenshot file"), {
        target: { files: [image("edge.png", "image/png", FIVE_MB)] },
      }),
    outcome: { previews: "edge.png" },
  },
  {
    name: "copied spreadsheet cells pasted into a text field stay text",
    deliver: () => {
      const defaultNotPrevented = fireEvent.paste(
        screen.getByLabelText("Title"),
        {
          clipboardData: {
            types: ["text/plain", "Files"],
            files: [
              image("cells.tiff", "image/tiff"),
              image("cells.png", "image/png"),
            ],
            getData: () => "A1",
          },
        },
      );
      expect(defaultNotPrevented).toBe(true);
    },
    outcome: "nothing",
  },
];

interface Refusal {
  name: string;
  entry: Entry;
  messages: readonly string[];
}

const GOOD = { kind: "Bug", title: "Mic cuts out", details: "It drops." };

const REFUSALS: readonly Refusal[] = [
  {
    name: "nothing filled in",
    entry: {},
    messages: [
      "Choose what kind of feedback this is.",
      "Give your feedback a short title.",
      "Tell us a little more so we can look into it.",
    ],
  },
  {
    name: "no kind",
    entry: { title: "Mic cuts out", details: "It drops." },
    messages: ["Choose what kind of feedback this is."],
  },
  {
    name: "a blank title",
    entry: { ...GOOD, title: "   " },
    messages: ["Give your feedback a short title."],
  },
  {
    name: "blank details",
    entry: { ...GOOD, details: "   " },
    messages: ["Tell us a little more so we can look into it."],
  },
  {
    name: "a 101-character title",
    entry: { ...GOOD, title: "t".repeat(101) },
    messages: ["Keep the title under 100 characters."],
  },
  {
    name: "2001 characters of details",
    entry: { ...GOOD, details: "d".repeat(2001) },
    messages: ["Keep the details under 2000 characters."],
  },
  {
    name: "a 101-character place",
    entry: { ...GOOD, where: "w".repeat(101) },
    messages: ["Keep this under 100 characters."],
  },
  {
    name: "a report with no name",
    entry: { ...GOOD, kind: "Report" },
    messages: ["Tell us who you are reporting."],
  },
  {
    name: "a report with a blank name",
    entry: { ...GOOD, kind: "Report", who: "   " },
    messages: ["Tell us who you are reporting."],
  },
  {
    name: "a report with an 81-character name",
    entry: { ...GOOD, kind: "Report", who: "n".repeat(81) },
    messages: ["Keep this under 80 characters."],
  },
];

interface Acceptance {
  name: string;
  entry: Entry;
  body: Sent;
}

const ACCEPTANCES: readonly Acceptance[] = [
  {
    name: "a bug with a place",
    entry: { ...GOOD, where: "  Pod 3  " },
    body: {
      type: "bug",
      title: "Mic cuts out",
      details: "It drops.",
      about: "Pod 3",
    },
  },
  {
    name: "an idea with no place",
    entry: { kind: "Idea", title: "Dark mode", details: "Please." },
    body: { type: "idea", title: "Dark mode", details: "Please." },
  },
  {
    name: "a report with a name and a place",
    entry: { ...GOOD, kind: "Report", who: "Ana Okafor", where: "Classroom A" },
    body: {
      type: "report",
      title: "Mic cuts out",
      details: "It drops.",
      about: "Ana Okafor | Classroom A",
    },
  },
  {
    name: "a report with a name and no place",
    entry: { ...GOOD, kind: "Report", who: "Ana Okafor" },
    body: {
      type: "report",
      title: "Mic cuts out",
      details: "It drops.",
      about: "Ana Okafor |",
    },
  },
  {
    name: "a report whose name contains a bar",
    entry: { ...GOOD, kind: "Report", who: "Ana|Maria", where: "Hall" },
    body: {
      type: "report",
      title: "Mic cuts out",
      details: "It drops.",
      about: "Ana/Maria | Hall",
    },
  },
  {
    name: "a title of exactly 100 characters",
    entry: { ...GOOD, title: "t".repeat(100) },
    body: { type: "bug", title: "t".repeat(100), details: "It drops." },
  },
];

const FAILURES: readonly { status: number; message: string }[] = [
  {
    status: 400,
    message: "We couldn't send that. Check the fields and try again.",
  },
  {
    status: 403,
    message: "You don't have permission to send feedback right now.",
  },
  {
    status: 429,
    message:
      "You've sent a lot of feedback in the last hour. Please try again later.",
  },
  {
    status: 500,
    message:
      "We couldn't send your feedback. Check your connection and try again.",
  },
];

afterEach(() => {
  cleanup();
  mockApi.reset();
  navigations.length = 0;
});

afterAll(() => mockApi.close());

describe("Feedback eval (threshold: every case holds; 0 requests for a refused submit; exactly 1 request per accepted submit; the screenshot never leaves the browser)", () => {
  describe("a refused submit", () => {
    it.each(REFUSALS)(
      "$name shows its message and sends nothing",
      ({ entry, messages }) => {
        renderPopup();

        fillIn(entry);
        send();

        for (const message of messages) {
          expect(screen.getByText(message)).toBeVisible();
        }
        expect(feedbackPosts()).toHaveLength(0);
        expect(
          screen.queryByRole("heading", { name: /We got it/ }),
        ).not.toBeInTheDocument();
      },
    );
  });

  describe("an accepted submit", () => {
    it.each(ACCEPTANCES)(
      "$name sends one request, confirms, and lists it",
      async ({ entry, body }) => {
        const sent: Sent[] = [];
        accept(sent);
        renderPopup();

        fillIn(entry);
        send();

        expect(
          await screen.findByRole("heading", {
            name: "Thanks, Joseph. We got it",
          }),
        ).toBeVisible();
        expect(sent).toEqual([
          {
            ...body,
            cohortId: "cohort-1",
            context: { path: "/" },
          },
        ]);
        expect(feedbackPosts()).toHaveLength(1);
        expect(
          screen.getByRole("region", { name: "Feedback history" }),
        ).toHaveTextContent(String(body.title));
      },
    );

    it("sends once however many times Send is pressed", async () => {
      accept([]);
      renderPopup();

      fillIn(GOOD);
      send();
      send();
      send();

      await screen.findByRole("button", { name: "Send another" });
      expect(feedbackPosts()).toHaveLength(1);
    });
  });

  describe("a failed send", () => {
    it.each(FAILURES)(
      "a $status explains itself, keeps the form, and never retries",
      async ({ status, message }) => {
        mockApi.server.use(
          http.post(FEEDBACK_URL, () => new Response(null, { status })),
        );
        renderPopup();

        fillIn(GOOD);
        send();

        expect(await screen.findByText(message)).toBeVisible();
        expect(screen.getByLabelText("Title")).toHaveValue("Mic cuts out");
        expect(
          screen.getByRole("button", { name: "Send feedback" }),
        ).toBeEnabled();
        expect(feedbackPosts()).toHaveLength(1);
      },
    );

    it("a network failure explains itself and keeps the form", async () => {
      mockApi.server.use(http.post(FEEDBACK_URL, () => HttpResponse.error()));
      renderPopup();

      fillIn(GOOD);
      send();

      expect(
        await screen.findByText(
          "We couldn't send your feedback. Check your connection and try again.",
        ),
      ).toBeVisible();
      expect(screen.getByLabelText("Title")).toHaveValue("Mic cuts out");
    });

    it("an ended session goes to sign-in", async () => {
      mockApi.server.use(
        http.post(FEEDBACK_URL, () => new Response(null, { status: 401 })),
      );
      renderPopup();

      fillIn(GOOD);
      send();

      await waitFor(() => expect(navigations).toEqual(["/sign-in"]));
    });
  });

  describe("screenshots", () => {
    it.each(SCREENSHOTS)("$name", async ({ deliver, outcome }) => {
      renderPopup();

      deliver();

      if (outcome === "nothing") {
        expect(
          screen.queryByAltText("Screenshot preview"),
        ).not.toBeInTheDocument();
        expect(screen.queryByRole("alert")).not.toBeInTheDocument();
      } else if ("previews" in outcome) {
        expect(await screen.findByAltText("Screenshot preview")).toBeVisible();
        expect(screen.getByText(outcome.previews)).toBeVisible();
        expect(screen.queryByRole("alert")).not.toBeInTheDocument();
      } else {
        expect(screen.getByRole("alert")).toHaveTextContent(outcome.refuses);
        expect(
          screen.queryByAltText("Screenshot preview"),
        ).not.toBeInTheDocument();
      }
    });
  });

  describe("privacy", () => {
    it("sends only the typed fields, never the screenshot or its name", async () => {
      const bodies: string[] = [];
      mockApi.server.use(
        http.post(FEEDBACK_URL, async ({ request }) => {
          bodies.push(await request.text());
          return HttpResponse.json(
            {
              id: "feedback-1",
              type: "bug",
              title: GOOD.title,
              createdAt: "2026-10-16T12:00:00.000Z",
            },
            { status: 201 },
          );
        }),
      );
      renderPopup();

      fireEvent.change(screen.getByLabelText("Screenshot file"), {
        target: { files: [image("private-screenshot.png", "image/png")] },
      });
      await screen.findByAltText("Screenshot preview");
      fillIn(GOOD);
      send();
      await screen.findByRole("button", { name: "Send another" });

      expect(bodies).toHaveLength(1);
      expect(Object.keys(JSON.parse(bodies[0] ?? "{}")).sort()).toEqual([
        "cohortId",
        "context",
        "details",
        "title",
        "type",
      ]);
      expect(bodies[0]).not.toContain("private-screenshot");
      expect(bodies[0]).not.toContain("data:image");
    });

    it("makes no request other than the feedback post", async () => {
      accept([]);
      renderPopup();

      fireEvent.change(screen.getByLabelText("Screenshot file"), {
        target: { files: [image("pod.png", "image/png")] },
      });
      await screen.findByAltText("Screenshot preview");
      fillIn(GOOD);
      send();
      await screen.findByRole("button", { name: "Send another" });

      expect(mockApi.requests.map((request) => request.url)).toEqual([
        FEEDBACK_URL,
      ]);
    });
  });
});
