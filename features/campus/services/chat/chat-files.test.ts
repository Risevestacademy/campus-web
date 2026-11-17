import { describe, expect, it } from "vitest";

import type { ChatAttachment } from "@/core/realtime";

import {
  fileKindOf,
  fileNameOf,
  formatFileSize,
  selectChatFiles,
} from "./chat-files";
import type { ChatMessage } from "./chat-messages";

function file(
  contentType: string,
  fileName: string | null = "a",
): ChatAttachment {
  return { mediaId: "m", fileName, contentType, sizeBytes: 1 };
}

describe("fileKindOf", () => {
  it.each([
    ["image/png", "image"],
    ["image/gif", "image"],
    ["application/pdf", "pdf"],
    ["application/msword", "document"],
    [
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "document",
    ],
    ["application/vnd.ms-excel", "spreadsheet"],
    [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "spreadsheet",
    ],
    ["application/vnd.ms-powerpoint", "presentation"],
    [
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "presentation",
    ],
    ["APPLICATION/PDF", "pdf"],
    ["application/x-sh", "file"],
    ["text/html", "file"],
  ])("takes %s for a %s", (contentType, kind) => {
    expect(fileKindOf(file(contentType))).toBe(kind);
  });
});

describe("fileNameOf", () => {
  it("uses the name the sender gave, trimmed", () => {
    expect(fileNameOf(file("image/png", "  plan.png "))).toBe("plan.png");
  });

  it.each([null, "", "   "])("gives a plain name for %j", (name) => {
    expect(fileNameOf(file("image/png", name))).toBe("File");
  });
});

describe("formatFileSize", () => {
  it.each([
    [0, "0 B"],
    [999, "999 B"],
    [1024, "1 KB"],
    [48_213, "47 KB"],
    [1_048_575, "1024 KB"],
    [1_048_576, "1.0 MB"],
    [1_234_567, "1.2 MB"],
    [26_214_400, "25.0 MB"],
  ])("writes %i bytes as %s", (bytes, written) => {
    expect(formatFileSize(bytes)).toBe(written);
  });
});

describe("selectChatFiles", () => {
  const message = (
    id: string,
    attachment: ChatAttachment | null,
  ): ChatMessage => ({
    id,
    userId: "grace",
    name: "Grace Hopper",
    initial: "G",
    avatarClassName: "x",
    text: "",
    attachment,
    at: `2026-11-17T15:0${id}:00.000Z`,
    isOwn: false,
  });

  it("lists the files sent in the space, newest first, with who sent them", () => {
    const files = selectChatFiles([
      message("1", file("application/pdf")),
      message("2", null),
      message("3", file("image/png")),
    ]);

    expect(files.map(({ id }) => id)).toEqual(["3", "1"]);
    expect(files[0]).toMatchObject({
      senderName: "Grace Hopper",
      at: "2026-11-17T15:03:00.000Z",
    });
  });

  it("lists nothing when no file was sent", () => {
    expect(selectChatFiles([message("1", null)])).toEqual([]);
  });
});
