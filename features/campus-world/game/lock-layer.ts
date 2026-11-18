import type { Space } from "campus-world-map";
import type { FormattedText, GameObj, KAPLAYCtx } from "kaplay";

import type { Presence } from "@/core/presence";

import {
  buildLockedSpaceDrawList,
  hatchSegments,
  type LockedSpaceDraw,
} from "../services/space-locks/locked-space-draw-list";
import type { TileSize } from "../services/tile-centre";

interface LockLayerOptions {
  map: TileSize;
  readPresence: () => Presence;
  spaces: readonly Space[];
}

const SHADE_COLOUR = "#162350";
const SHADE_OPACITY = 0.1;
const HATCH_OPACITY = 0.3;
const HATCH_SPACING = 8;
const HATCH_WIDTH = 2;
const EDGE_OPACITY = 0.55;
const EDGE_WIDTH = 2;
const PLATE_COLOUR = "#252525";
const PLATE_TEXT_COLOUR = "#f7f7f7";
const PLATE_TEXT_SIZE = 8;
const PLATE_HEIGHT = 12;
const PLATE_PADDING = 5;
const LOCK_WIDTH = 5;
const LOCK_GAP = 3;

// The hatch lies on the floor, under avatars; the plate is drawn over the
// furniture above them, so a name is never hidden.
export function addLockLayers(
  k: KAPLAYCtx,
  { map, readPresence, spaces }: LockLayerOptions,
): { floor: GameObj; plates: GameObj } {
  const shade = k.rgb(SHADE_COLOUR);
  const plateColour = k.rgb(PLATE_COLOUR);
  const plateText = k.rgb(PLATE_TEXT_COLOUR);
  const labels = new Map<string, FormattedText>();

  function points(draw: LockedSpaceDraw) {
    return draw.outline.map(({ x, y }) => k.vec2(x, y));
  }

  function drawFloor(draw: LockedSpaceDraw) {
    const pts = points(draw);
    k.drawPolygon({ pts, color: shade, opacity: SHADE_OPACITY });
    if (draw.hatched) {
      for (const { from, to } of hatchSegments(draw.outline, HATCH_SPACING)) {
        k.drawLine({
          p1: k.vec2(from.x, from.y),
          p2: k.vec2(to.x, to.y),
          width: HATCH_WIDTH,
          color: shade,
          opacity: HATCH_OPACITY,
        });
      }
    }
    k.drawLines({
      pts: [...pts, pts[0]!],
      width: EDGE_WIDTH,
      color: shade,
      opacity: EDGE_OPACITY,
    });
  }

  function formattedLabel(label: string): FormattedText {
    let formatted = labels.get(label);
    if (!formatted) {
      formatted = k.formatText({
        anchor: "left",
        color: plateText,
        size: PLATE_TEXT_SIZE,
        text: label,
      });
      labels.set(label, formatted);
    }
    return formatted;
  }

  function drawLock(x: number, y: number) {
    k.drawRect({
      pos: k.vec2(x, y - 1),
      width: LOCK_WIDTH,
      height: 4,
      color: plateText,
    });
    k.drawLines({
      pts: [
        k.vec2(x + 1, y - 1),
        k.vec2(x + 1, y - 3),
        k.vec2(x + LOCK_WIDTH - 1, y - 3),
        k.vec2(x + LOCK_WIDTH - 1, y - 1),
      ],
      width: 1,
      color: plateText,
    });
  }

  function drawPlate({ label, plate }: LockedSpaceDraw) {
    const text = formattedLabel(label);
    const width = PLATE_PADDING * 2 + LOCK_WIDTH + LOCK_GAP + text.width;
    const left = plate.x - width / 2;
    k.drawRect({
      pos: k.vec2(left, plate.y - PLATE_HEIGHT / 2),
      width,
      height: PLATE_HEIGHT,
      radius: PLATE_HEIGHT / 2,
      color: plateColour,
    });
    drawLock(left + PLATE_PADDING, plate.y + 1);
    k.pushTransform();
    k.pushTranslate(left + PLATE_PADDING + LOCK_WIDTH + LOCK_GAP, plate.y);
    k.drawFormattedText(text);
    k.popTransform();
  }

  function drawList() {
    return buildLockedSpaceDrawList(spaces, readPresence(), map);
  }

  return {
    floor: k.add([
      k.layer("below"),
      {
        draw() {
          drawList().forEach(drawFloor);
        },
      },
    ]),
    plates: k.add([
      k.layer("above"),
      {
        draw() {
          const list = drawList();
          list.forEach(drawPlate);
          if (labels.size > list.length) labels.clear();
        },
      },
    ]),
  };
}
