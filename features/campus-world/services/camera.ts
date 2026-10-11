interface Size {
  height: number;
  width: number;
}

interface Point {
  x: number;
  y: number;
}

function clampAxis(target: number, viewport: number, map: number): number {
  if (map <= viewport) {
    return map / 2;
  }

  const halfViewport = viewport / 2;
  return Math.min(Math.max(target, halfViewport), map - halfViewport);
}

export function clampCamera(target: Point, viewport: Size, map: Size): Point {
  return {
    x: clampAxis(target.x, viewport.width, map.width),
    y: clampAxis(target.y, viewport.height, map.height),
  };
}
