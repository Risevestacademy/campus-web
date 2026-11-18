import { z } from "zod";

import { parseJson } from "@/shared/lib/parse-json";

import { DEFAULT_ZOOM, ZOOM_LEVELS, type ZoomLevel } from "./camera";

const STORAGE_KEY = "campus-world-zoom";
const storedZoomSchema = z.literal(ZOOM_LEVELS);

export function loadZoomLevel(): ZoomLevel {
  try {
    return (
      parseJson(storedZoomSchema, window.localStorage.getItem(STORAGE_KEY)) ??
      DEFAULT_ZOOM
    );
  } catch {
    return DEFAULT_ZOOM;
  }
}

export function saveZoomLevel(level: ZoomLevel): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(level));
  } catch {
    // The level still holds for this visit when storage is unavailable.
  }
}
