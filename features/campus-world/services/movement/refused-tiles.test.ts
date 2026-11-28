import { describe, expect, it } from "vitest";

import type { MoveOutcome, Player } from "@/core/realtime";
import { movementLayout } from "@/features/campus-world/testing/movement";

import {
  forgetStaleFullTiles,
  FULL_TILE_MEMORY_MS,
  learnRefusedTiles,
  rememberFullTile,
  withRefusedTiles,
} from "./refused-tiles";
import { predictStep } from "./step";

function answer(outcome: MoveOutcome, player: Omit<Player, "userId">) {
  return { outcome, player: { userId: "ada", ...player } };
}

describe("learnRefusedTiles", () => {
  it("learns the tile world refused, the one the person now faces", () => {
    expect(
      learnRefusedTiles([], answer("refused", { x: 0, y: 0, facing: "right" })),
    ).toEqual([{ x: 1, y: 0 }]);
  });

  it("learns a tile once however often it is refused", () => {
    const refused = [{ x: 1, y: 0 }];

    expect(
      learnRefusedTiles(
        refused,
        answer("refused", { x: 0, y: 0, facing: "right" }),
      ),
    ).toBe(refused);
  });

  it("forgets a tile world lets the person onto", () => {
    expect(
      learnRefusedTiles(
        [
          { x: 1, y: 0 },
          { x: 3, y: 3 },
        ],
        answer("moved", { x: 1, y: 0, facing: "right" }),
      ),
    ).toEqual([{ x: 3, y: 3 }]);
  });

  it.each<MoveOutcome>(["blocked", "too_fast", "unknown"])(
    "learns nothing from %s",
    (outcome) => {
      const refused = [{ x: 1, y: 0 }];

      expect(
        learnRefusedTiles(
          refused,
          answer(outcome, { x: 0, y: 0, facing: "up" }),
        ),
      ).toBe(refused);
    },
  );
});

describe("withRefusedTiles", () => {
  it("keeps the layout as it is while nothing is refused", () => {
    expect(withRefusedTiles(movementLayout, [])).toBe(movementLayout);
  });

  it("predicts a turn without a step into a refused tile, as world answers", () => {
    const layout = withRefusedTiles(movementLayout, [{ x: 1, y: 0 }]);

    expect(
      predictStep(
        { userId: "ada", x: 0, y: 0, facing: "down" },
        "right",
        layout,
      ),
    ).toEqual({ userId: "ada", x: 0, y: 0, facing: "right" });
  });
});

describe("full tiles", () => {
  const facingFull = answer("full", { x: 0, y: 0, facing: "right" });

  it("shuts the tile a full answer faced for a while", () => {
    expect(rememberFullTile([], facingFull, 1000)).toEqual([
      { x: 1, y: 0, until: 1000 + FULL_TILE_MEMORY_MS },
    ]);
  });

  it("renews a tile asked about again instead of listing it twice", () => {
    const first = rememberFullTile([], facingFull, 0);

    expect(rememberFullTile(first, facingFull, 500)).toEqual([
      { x: 1, y: 0, until: 500 + FULL_TILE_MEMORY_MS },
    ]);
  });

  it.each<MoveOutcome>(["moved", "refused", "blocked", "too_fast", "unknown"])(
    "remembers nothing from %s",
    (outcome) => {
      const none: never[] = [];

      expect(
        rememberFullTile(
          none,
          answer(outcome, { x: 0, y: 0, facing: "right" }),
          0,
        ),
      ).toBe(none);
    },
  );

  it("forgets a tile once its time is up and keeps the rest", () => {
    const full = [
      { x: 1, y: 0, until: 100 },
      { x: 3, y: 3, until: 900 },
    ];

    expect(forgetStaleFullTiles(full, 99)).toBe(full);
    expect(forgetStaleFullTiles(full, 100)).toEqual([
      { x: 3, y: 3, until: 900 },
    ]);
  });
});
