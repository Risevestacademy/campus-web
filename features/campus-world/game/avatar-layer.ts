import type { MapLayout } from "campus-world-map";
import type { FormattedText, GameObj, KAPLAYCtx, Key } from "kaplay";

import type { Presence } from "@/core/presence";
import type { Direction, MoveCorrection, WorldMovement } from "@/core/realtime";

import {
  type AvatarDraw,
  buildAvatarDrawList,
} from "../services/avatars/avatar-draw-list";
import { prefersReducedMotion } from "../services/reduced-motion";
import type { CampusCamera } from "./campus-camera";
import { createOwnAvatarMovement } from "./own-avatar-movement";
import { createRemoteAvatarMovement } from "./remote-avatar-movement";

interface AvatarLayerOptions {
  camera: Pick<CampusCamera, "update">;
  layout: MapLayout;
  map: { height: number; tileheight: number; tilewidth: number; width: number };
  movement: WorldMovement;
  onMoveCorrected: (outcome: MoveCorrection) => void;
  readPresence: () => Presence;
}

const BODY_COLOUR = "#3d5afe";
const FACE_COLOUR = "#ffffff";
const SELF_RING_COLOUR = "#e8ff59";
const LABEL_COLOUR = "#ffffff";
const LABEL_SIZE = 8;
const BODY_SHARE_OF_TILE = 0.35;

const DIRECTION_KEYS = {
  up: ["up", "w"],
  down: ["down", "s"],
  left: ["left", "a"],
  right: ["right", "d"],
} as const satisfies Record<Direction, readonly string[]>;
const DIRECTIONS = Object.keys(DIRECTION_KEYS) as Direction[];

const FACING: Record<Direction, { x: number; y: number }> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

// Every spriteKey draws this one placeholder until character art exists.
export function addAvatarLayer(
  k: KAPLAYCtx,
  {
    camera,
    layout,
    map,
    movement,
    onMoveCorrected,
    readPresence,
  }: AvatarLayerOptions,
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
  const ownMovement = createOwnAvatarMovement({
    layout,
    movement,
    onMoveCorrected,
    prefersReducedMotion,
    readPresence,
  });
  const remoteMovement = createRemoteAvatarMovement({
    layout,
    movement,
    prefersReducedMotion,
    readPresence,
  });

  function readsKey(read: (key: Key) => boolean, direction: Direction) {
    return DIRECTION_KEYS[direction].some(read);
  }

  function pressedDirection(): Direction | null {
    let pressed: Direction | null = null;
    for (const direction of DIRECTIONS) {
      if (readsKey((key) => k.isKeyPressed(key), direction)) {
        pressed = direction;
      }
    }
    return pressed;
  }

  function heldDirections(): Direction[] {
    return DIRECTIONS.filter((direction) =>
      readsKey((key) => k.isKeyDown(key), direction),
    );
  }

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
        const deltaMs = k.dt() * 1000;
        const held = heldDirections();
        const pressed = pressedDirection();
        ownMovement.update({ deltaMs, held, pressed });
        remoteMovement.update(deltaMs);
        camera.update({
          deltaMs,
          self: ownMovement.readPlayer(),
          walking: pressed !== null || held.length > 0,
        });
      },
      draw() {
        const list = buildAvatarDrawList(readPresence(), map, {
          remotes: remoteMovement.readPlayers(),
          self: ownMovement.readPlayer(),
        });
        list.forEach(drawAvatar);
        forgetLabelsNotIn(list);
      },
      destroy() {
        ownMovement.stop();
        remoteMovement.stop();
      },
    },
  ]);
}
