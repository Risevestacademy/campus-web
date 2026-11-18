import { describe, expect, it } from "vitest";

import type { MoveOutcome, Player } from "@/core/realtime";
import { movementLayout } from "@/features/campus-world/testing/movement";

import { learnRefusedTiles, withRefusedTiles } from "./refused-tiles";
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
