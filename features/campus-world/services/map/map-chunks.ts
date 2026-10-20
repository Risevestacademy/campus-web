interface Size {
  height: number;
  width: number;
}

export interface MapChunk {
  height: number;
  width: number;
  x: number;
  y: number;
}

// Centre-based, like the camera and the viewport culler.
export interface WorldView {
  height: number;
  width: number;
  x: number;
  y: number;
}

interface AxisSpan {
  size: number;
  start: number;
}

function axisSpans(length: number, chunkSize: number): AxisSpan[] {
  const spans: AxisSpan[] = [];
  for (let start = 0; start < length; start += chunkSize) {
    spans.push({ size: Math.min(chunkSize, length - start), start });
  }
  return spans;
}

export function mapChunks(world: Size, chunkSize: number): MapChunk[] {
  const columns = axisSpans(world.width, chunkSize);
  return axisSpans(world.height, chunkSize).flatMap((row) =>
    columns.map((column) => ({
      height: row.size,
      width: column.size,
      x: column.start,
      y: row.start,
    })),
  );
}

export function chunkView({ height, width, x, y }: MapChunk): WorldView {
  return { height, width, x: x + width / 2, y: y + height / 2 };
}

export function chunkInView(chunk: MapChunk, view: WorldView): boolean {
  return (
    chunk.x < view.x + view.width / 2 &&
    chunk.x + chunk.width > view.x - view.width / 2 &&
    chunk.y < view.y + view.height / 2 &&
    chunk.y + chunk.height > view.y - view.height / 2
  );
}

export function grownView(view: WorldView, margin: number): WorldView {
  return {
    ...view,
    height: view.height + margin * 2,
    width: view.width + margin * 2,
  };
}
