import type { FormattedText, GameObj, KAPLAYCtx } from "kaplay";

import type { Presence } from "@/core/presence";
import type { Direction } from "@/core/realtime";

import {
  type AvatarDraw,
  buildAvatarDrawList,
} from "../services/avatars/avatar-draw-list";
import { followCamera } from "../services/camera";

interface AvatarLayerOptions {
  map: { height: number; tileheight: number; tilewidth: number; width: number };
  readPresence: () => Presence;
}

const BODY_COLOUR = "#3d5afe";
const FACE_COLOUR = "#ffffff";
const SELF_RING_COLOUR = "#e8ff59";
const LABEL_COLOUR = "#ffffff";
const LABEL_SIZE = 8;
const BODY_SHARE_OF_TILE = 0.35;

const FACING: Record<Direction, { x: number; y: number }> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

// Every spriteKey draws this one placeholder until character art exists.
export function addAvatarLayer(
  k: KAPLAYCtx,
  { map, readPresence }: AvatarLayerOptions,
): GameObj {
  const radius = Math.min(map.tilewidth, map.tileheight) * BODY_SHARE_OF_TILE;
  const colours = {
    body: k.rgb(BODY_COLOUR),
    face: k.rgb(FACE_COLOUR),
    label: k.rgb(LABEL_COLOUR),
    selfRing: k.rgb(SELF_RING_COLOUR),
  };
  // Laying text out is the costly part of a frame; a name changes rarely.
  const labels = new Map<string, FormattedText>();

  function formattedLabel(label: string): FormattedText {
    let formatted = labels.get(label);
    if (!formatted) {
      formatted = k.formatText({
        anchor: "bot",
        color: colours.label,
        size: LABEL_SIZE,
        text: label,
      });
      labels.set(label, formatted);
    }
    return formatted;
  }

  function drawAvatar({ facing, isSelf, label, x, y }: AvatarDraw) {
    const direction = FACING[facing];
    k.drawCircle({
      color: colours.body,
      outline: isSelf ? { color: colours.selfRing, width: 2 } : undefined,
      pos: k.vec2(x, y),
      radius,
    });
    k.drawCircle({
      color: colours.face,
      pos: k.vec2(
        x + direction.x * radius * 0.6,
        y + direction.y * radius * 0.6,
      ),
      radius: radius * 0.3,
    });
    if (label === null) return;

    k.pushTransform();
    k.pushTranslate(x, y - radius - 1);
    k.drawFormattedText(formattedLabel(label));
    k.popTransform();
  }

  function forgetLabelsNotIn(list: AvatarDraw[]) {
    if (labels.size <= list.length) return;
    const drawn = new Set(list.map(({ label }) => label));
    for (const label of labels.keys()) {
      if (!drawn.has(label)) labels.delete(label);
    }
  }

  return k.add([
    k.layer("avatars"),
    {
      update() {
        const { positions, selfId } = readPresence();
        const self = selfId === null ? undefined : positions.get(selfId);
        if (!self) return;

        const camera = followCamera(self, map, {
          height: k.height(),
          width: k.width(),
        });
        k.setCamPos(k.vec2(camera.x, camera.y));
      },
      draw() {
        const list = buildAvatarDrawList(readPresence(), map);
        list.forEach(drawAvatar);
        forgetLabelsNotIn(list);
      },
    },
  ]);
}
