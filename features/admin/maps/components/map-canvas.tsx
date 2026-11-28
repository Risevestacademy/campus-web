"use client";

import type { Bounds } from "campus-world-map";
import { cn } from "cn";
import { useId } from "react";

import type { MapChange, MapView, ViewSpace } from "../services/map-view";
import { FLOOR, GROUP_COLORS, WALLS } from "./space-colors";
import { KIND_GROUPS, KIND_LABELS } from "./space-labels";

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

function boxOf(bounds: Bounds): Box {
  if (bounds.shape === "rect") return bounds;
  const xs = bounds.points.map(({ x }) => x);
  const ys = bounds.points.map(({ y }) => y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return {
    x,
    y,
    width: Math.max(...xs) - x,
    height: Math.max(...ys) - y,
  };
}

// Tiles of floor kept around the spaces.
const FRAME_MARGIN = 3;

// A published map is mostly open ground inside its outer fence. The frame is
// its spaces plus a margin, so the rooms fill the view; walls past the edge
// are cut off.
function frameOf(
  boxes: readonly Box[],
  widthTiles: number,
  heightTiles: number,
): Box {
  if (boxes.length === 0) {
    return { x: 0, y: 0, width: widthTiles, height: heightTiles };
  }
  const left = Math.max(0, Math.min(...boxes.map(({ x }) => x)) - FRAME_MARGIN);
  const top = Math.max(0, Math.min(...boxes.map(({ y }) => y)) - FRAME_MARGIN);
  const right = Math.min(
    widthTiles,
    Math.max(...boxes.map(({ x, width }) => x + width)) + FRAME_MARGIN,
  );
  const bottom = Math.min(
    heightTiles,
    Math.max(...boxes.map(({ y, height }) => y + height)) + FRAME_MARGIN,
  );
  return { x: left, y: top, width: right - left, height: bottom - top };
}

const percent = (value: number, of: number) => `${(value / of) * 100}%`;

// A polygon's trigger covers its bounding box; the clip path keeps clicks to
// the shape itself.
function clipPathOf(bounds: Bounds, box: Box): string | undefined {
  if (bounds.shape === "rect" || box.width === 0 || box.height === 0) {
    return undefined;
  }
  const points = bounds.points
    .map(
      ({ x, y }) =>
        `${percent(x - box.x, box.width)} ${percent(y - box.y, box.height)}`,
    )
    .join(", ");
  return `polygon(${points})`;
}

function Shape({
  bounds,
  rounded,
  fill,
  className,
}: {
  bounds: Bounds;
  rounded?: boolean;
  fill?: string;
  className?: string;
}) {
  return bounds.shape === "rect" ? (
    <rect
      x={bounds.x}
      y={bounds.y}
      width={bounds.width}
      height={bounds.height}
      rx={rounded ? 0.6 : 0}
      vectorEffect="non-scaling-stroke"
      fill={fill}
      className={className}
    />
  ) : (
    <polygon
      points={bounds.points.map(({ x, y }) => `${x},${y}`).join(" ")}
      vectorEffect="non-scaling-stroke"
      fill={fill}
      className={className}
    />
  );
}

// A set-up space takes its kind's colour. One that needs a kind is hatched,
// so it never reads as a colour of its own; one not in the campus is only an
// outline.
function shapeClass(space: ViewSpace): string {
  if (space.state === "not-synced") {
    return "fill-background/50 stroke-neutral-500 [stroke-dasharray:5_4]";
  }
  if (space.state === "needs-kind" || !space.settings?.kind) {
    return "stroke-warning";
  }
  return GROUP_COLORS[KIND_GROUPS[space.settings.kind]].shape;
}

function dotClass(space: ViewSpace): string {
  if (space.state === "not-synced") {
    return "border border-dashed border-neutral-500";
  }
  if (space.state === "needs-kind" || !space.settings?.kind) {
    return "bg-warning";
  }
  return GROUP_COLORS[KIND_GROUPS[space.settings.kind]].dot;
}

// What a sync changes is drawn over the space's own colour, not instead of it.
const CHANGE_OUTLINES: Readonly<Record<MapChange, string>> = {
  added: "stroke-success-700 stroke-[2.5]",
  restored: "stroke-cobalt-700 stroke-[2.5]",
};

const CHANGE_BADGES: Readonly<
  Record<MapChange, { label: string; className: string }>
> = {
  added: { label: "New", className: "bg-success-foreground text-white" },
  restored: { label: "Back", className: "bg-primary text-primary-foreground" },
};

function describe(space: ViewSpace, showChanges: boolean): string {
  const state =
    space.state === "not-synced"
      ? "not in the campus yet"
      : space.state === "needs-kind"
        ? "needs a kind"
        : space.settings?.kind
          ? KIND_LABELS[space.settings.kind]
          : "set up";
  const change =
    showChanges && space.change
      ? space.change === "added"
        ? ", added by this sync"
        : ", restored by this sync"
      : "";
  return `${space.name}, ${state}${change}`;
}

function tagOf(space: ViewSpace): string {
  if (space.state === "not-synced") return "Not synced";
  if (space.state === "needs-kind") return "No kind";
  return space.settings?.kind ? KIND_LABELS[space.settings.kind] : "";
}

function SpaceSpot({
  space,
  frame,
  showChanges,
  selected,
  onSelect,
}: {
  space: ViewSpace;
  frame: Box;
  showChanges: boolean;
  selected: boolean;
  onSelect: () => void;
}) {
  const box = boxOf(space.bounds);
  const badge =
    showChanges && space.change ? CHANGE_BADGES[space.change] : null;

  return (
    <button
      type="button"
      aria-label={describe(space, showChanges)}
      aria-pressed={selected}
      onClick={onSelect}
      className={cn(
        "group/space focus-visible:ring-ring/60 @container absolute flex flex-col items-start justify-between rounded-md p-1 text-left outline-none hover:z-10 focus-visible:z-10 focus-visible:ring-3",
        // A polygon is clipped to its shape; a rectangle lets a long name
        // spill out while it is pointed at.
        space.bounds.shape === "rect" ? "overflow-visible" : "overflow-hidden",
      )}
      style={{
        left: percent(box.x - frame.x, frame.width),
        top: percent(box.y - frame.y, frame.height),
        width: percent(box.width, frame.width),
        height: percent(box.height, frame.height),
        clipPath: clipPathOf(space.bounds, box),
      }}
    >
      <span className="bg-background/90 text-foreground flex max-w-full items-center gap-1 rounded-full px-1.5 py-0.5 text-[11px] leading-tight font-semibold shadow-xs group-hover/space:max-w-none group-hover/space:shadow-md group-focus-visible/space:max-w-none">
        <span
          aria-hidden
          className={cn("size-1.5 shrink-0 rounded-full", dotClass(space))}
        />
        <span className="truncate">{space.name}</span>
      </span>
      <span className="text-foreground-secondary hidden max-w-full truncate px-1 text-[10px] @min-[96px]:block">
        {tagOf(space)}
      </span>
      {badge ? (
        <span
          className={cn(
            "rounded px-1 py-px text-[9px] font-bold tracking-wide uppercase",
            badge.className,
          )}
        >
          {badge.label}
        </span>
      ) : null}
    </button>
  );
}

export function MapCanvas({
  widthTiles,
  heightTiles,
  walls,
  view,
  showChanges,
  selectedKey,
  onSelect,
}: {
  widthTiles: number;
  heightTiles: number;
  walls: readonly Bounds[];
  view: MapView;
  showChanges: boolean;
  selectedKey: string | null;
  onSelect: (key: string | null) => void;
}) {
  const hatchId = useId();
  const frame = frameOf(
    view.spaces.map(({ bounds }) => boxOf(bounds)),
    widthTiles,
    heightTiles,
  );

  return (
    <div className="bg-surface border-border-subtle rounded-2xl border p-3 sm:p-4">
      <div
        className="relative mx-auto"
        // As wide as the card allows, unless that would make it taller than
        // the screen can show beside the toolbar.
        style={{
          aspectRatio: `${frame.width} / ${frame.height}`,
          width: `min(100%, calc(min(560px, 62vh) * ${frame.width / frame.height}))`,
        }}
      >
        <svg
          aria-hidden
          viewBox={`${frame.x} ${frame.y} ${frame.width} ${frame.height}`}
          preserveAspectRatio="none"
          shapeRendering="crispEdges"
          className="absolute inset-0 size-full overflow-hidden rounded-lg"
        >
          <defs>
            <pattern
              id={hatchId}
              width={0.8}
              height={0.8}
              patternUnits="userSpaceOnUse"
              patternTransform="rotate(45)"
            >
              <rect width={0.8} height={0.8} className="fill-warning/10" />
              <rect width={0.3} height={0.8} className="fill-warning/35" />
            </pattern>
          </defs>
          <rect
            x={frame.x}
            y={frame.y}
            width={frame.width}
            height={frame.height}
            className={FLOOR}
          />
          {walls.map((bounds, index) => (
            <Shape
              // Walls have no key of their own and never reorder.
              key={index}
              bounds={bounds}
              className={cn(WALLS, "stroke-none")}
            />
          ))}
          {view.spaces.map((space) => (
            <Shape
              key={space.key}
              bounds={space.bounds}
              rounded
              fill={
                space.state === "needs-kind" ? `url(#${hatchId})` : undefined
              }
              className={cn(
                "stroke-[1.5] transition-[fill,stroke]",
                shapeClass(space),
                showChanges && space.change && CHANGE_OUTLINES[space.change],
                space.key === selectedKey && "stroke-foreground stroke-[2.5]",
              )}
            />
          ))}
          {view.desks.map((desk) => (
            <rect
              key={desk.key}
              x={desk.x + 0.25}
              y={desk.y + 0.25}
              width={0.5}
              height={0.5}
              rx={0.1}
              className={
                showChanges && desk.change === "added"
                  ? "fill-success"
                  : "fill-cobalt-700/60 dark:fill-cobalt-300/60"
              }
            />
          ))}
        </svg>

        {view.spaces.map((space) => (
          <SpaceSpot
            key={space.key}
            space={space}
            frame={frame}
            showChanges={showChanges}
            selected={selectedKey === space.key}
            onSelect={() =>
              onSelect(selectedKey === space.key ? null : space.key)
            }
          />
        ))}
      </div>
    </div>
  );
}
