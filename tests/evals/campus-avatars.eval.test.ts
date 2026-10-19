// @vitest-environment node

import { describe, expect, it } from "vitest";

import { applyServerMessage, EMPTY_PRESENCE } from "@/core/presence";
import type { Avatar } from "@/core/realtime";
import { buildAvatarDrawList } from "@/features/campus-world/services/avatars/avatar-draw-list";

const TILE = { tileheight: 16, tilewidth: 16 };
const HOSTILE_DISPLAY_NAMES = [
  "Ada\\",
  "\\",
  "\\\\[b]",
  "[b]Grace",
  "Lin [/i]",
  "[b][/i]",
  "[/b]",
  "[".repeat(10_000),
  "]".repeat(10),
  "[wavy]hi[/wavy]",
  "名前 👋",
  "‮evil",
  "line\nbreak",
  "",
];

// KAPLAY's text formatter, as documented: `\x` is a literal x and `[` may
// open a style tag. Returns undefined when a `[` is left unescaped.
function readAsKaplayDoes(label: string): string | undefined {
  let text = "";
  for (let index = 0; index < label.length; index += 1) {
    const character = label[index]!;
    if (character === "[") return undefined;
    if (character === "\\") {
      if (index === label.length - 1) return undefined;
      index += 1;
      text += label[index];
    } else {
      text += character;
    }
  }
  return text;
}

function drawListFor(...players: Avatar[]) {
  return buildAvatarDrawList(
    applyServerMessage(EMPTY_PRESENCE, {
      type: "snapshot",
      map: { id: "campus", version: "v1", width: 60, height: 40 },
      players,
    }),
    TILE,
  );
}

describe("campus avatars eval", () => {
  it.each(HOSTILE_DISPLAY_NAMES)(
    "draws the display name %j exactly as written, with no style tag",
    (displayName) => {
      const [entry] = drawListFor({
        userId: "member",
        x: 0,
        y: 0,
        facing: "down",
        displayName,
        spriteKey: null,
      });

      expect(readAsKaplayDoes(entry!.label!)).toBe(displayName);
    },
  );

  it("draws everyone once, whatever their sprite key", () => {
    const list = drawListFor(
      ...["placeholder-1", "no-such-sprite", "", null].map(
        (spriteKey, index) => ({
          userId: `member-${index}`,
          x: index,
          y: index,
          facing: "up" as const,
          displayName: null,
          spriteKey,
        }),
      ),
    );

    expect(list.map(({ userId }) => userId)).toEqual([
      "member-0",
      "member-1",
      "member-2",
      "member-3",
    ]);
  });
});
