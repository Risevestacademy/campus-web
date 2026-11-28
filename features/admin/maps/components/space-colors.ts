import type { KindGroup } from "./space-labels";

// Each group's colour: the shape on the map, the dot on its label, and the
// swatch in the legend.
export const GROUP_COLORS: Readonly<
  Record<KindGroup, { shape: string; dot: string; swatch: string }>
> = {
  gather: {
    shape: "fill-cobalt-400/25 stroke-cobalt-500",
    dot: "bg-cobalt-500",
    swatch: "bg-cobalt-400/25 border-cobalt-500",
  },
  learn: {
    shape: "fill-turquoise-400/30 stroke-turquoise-700",
    dot: "bg-turquoise-500",
    swatch: "bg-turquoise-400/30 border-turquoise-700",
  },
  talk: {
    shape: "fill-error-300/30 stroke-error-400",
    dot: "bg-error-400",
    swatch: "bg-error-300/30 border-error-400",
  },
  work: {
    shape: "fill-success-400/25 stroke-success-700",
    dot: "bg-success-500",
    swatch: "bg-success-400/25 border-success-700",
  },
  // Not yellow: yellow, hatched, is a space that needs a kind.
  help: {
    shape: "fill-info-300/35 stroke-info-500",
    dot: "bg-info-500",
    swatch: "bg-info-300/35 border-info-500",
  },
};

export const FLOOR = "fill-lemon-50 dark:fill-cobalt-950";
export const WALLS = "fill-cobalt-900/85 dark:fill-cobalt-300/45";
