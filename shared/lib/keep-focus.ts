import type { MouseEvent } from "react";

// Pressing a button would take focus from the canvas and stop Arrow keys.
export function keepFocus(event: MouseEvent) {
  event.preventDefault();
}
