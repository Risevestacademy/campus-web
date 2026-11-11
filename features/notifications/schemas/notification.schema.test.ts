import { describe, expect, it } from "vitest";

import { parseNotificationPage } from "./notification.schema";

const META = { page: 1, perPage: 20, total: 2, totalPages: 1 };
const ADMITTED = {
  id: "n-1",
  kind: "entry_request_admitted",
  referenceType: "entry_request",
  referenceId: "r-1",
  context: { cohortId: "c-1", spaceKey: "library" },
  read: false,
  createdAt: "2026-11-11T10:00:00.000Z",
};
const POSTED = {
  id: "n-2",
  kind: "notice_posted",
  referenceType: "notice",
  referenceId: "notice-1",
  context: null,
  read: true,
  createdAt: "2026-11-10T10:00:00.000Z",
};

describe("parseNotificationPage", () => {
  it("keeps only what the list shows, and the paging", () => {
    expect(
      parseNotificationPage({ items: [ADMITTED, POSTED], meta: META }),
    ).toEqual({
      notifications: [
        {
          id: "n-1",
          kind: "entry_request_admitted",
          context: { cohortId: "c-1", spaceKey: "library" },
          read: false,
          createdAt: "2026-11-11T10:00:00.000Z",
        },
        {
          id: "n-2",
          kind: "notice_posted",
          context: null,
          read: true,
          createdAt: "2026-11-10T10:00:00.000Z",
        },
      ],
      page: 1,
      totalPages: 1,
      total: 2,
    });
  });

  it("reads a kind campus-api adds later as unknown, so one new kind does not fail the page", () => {
    const page = parseNotificationPage({
      items: [{ ...POSTED, kind: "calendar_invite" }],
      meta: META,
    });

    expect(page?.notifications[0]?.kind).toBe("unknown");
  });

  it("reads an empty page", () => {
    expect(
      parseNotificationPage({
        items: [],
        meta: { page: 1, perPage: 20, total: 0, totalPages: 0 },
      }),
    ).toEqual({ notifications: [], page: 1, totalPages: 0, total: 0 });
  });

  it.each([
    ["nothing", undefined],
    ["a list with no meta", { items: [ADMITTED] }],
    ["an item with no id", { items: [{ ...ADMITTED, id: "" }], meta: META }],
    [
      "an item whose read is not a boolean",
      { items: [{ ...ADMITTED, read: "no" }], meta: META },
    ],
    [
      "an item with no time",
      { items: [{ ...ADMITTED, createdAt: undefined }], meta: META },
    ],
    [
      "a context missing its space",
      { items: [{ ...ADMITTED, context: { cohortId: "c-1" } }], meta: META },
    ],
    ["a negative total", { items: [], meta: { ...META, total: -1 } }],
  ])("refuses %s", (_, body) => {
    expect(parseNotificationPage(body)).toBeUndefined();
  });
});
