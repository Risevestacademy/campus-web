import type { KAPLAYCtx } from "kaplay";
import { vi } from "vitest";

import { addMapBand, type RenderTileset } from "../game/map-renderer";
import type { TiledTileLayer } from "../services/map/layer-bands";
import type { CampusTiledMap } from "../services/map/load-campus-map";

const TILE = 16;

interface Point {
  x: number;
  y: number;
}

interface Size {
  height: number;
  width: number;
}

interface FakeBandOptions {
  camera?: Point;
  chunkSize?: number;
  onDraw?: () => void;
  scale?: number;
  viewport?: Size;
}

interface FakeSpriteOpt {
  fixed?: boolean;
  frame?: number;
  pos: Point;
  sprite: string;
}

interface FakeQuadOpt {
  flipY?: boolean;
  height: number;
  pos: Point;
  tex: string;
  width: number;
}

export interface BakedDraw {
  sprite: string;
  texel: Point;
  world: Point;
}

export interface FakeChunkCanvas {
  draws: BakedDraw[];
  fb: { tex: string };
  free: () => void;
  height: number;
  width: number;
}

// KAPLAY's Mat4 in 2D without rotation: translate and scale post-multiply.
class FakeMat4 {
  constructor(
    public scaleX = 1,
    public scaleY = 1,
    public translateX = 0,
    public translateY = 0,
  ) {}

  apply({ x, y }: Point): Point {
    return {
      x: this.scaleX * x + this.translateX,
      y: this.scaleY * y + this.translateY,
    };
  }

  clone(): FakeMat4 {
    return new FakeMat4(
      this.scaleX,
      this.scaleY,
      this.translateX,
      this.translateY,
    );
  }
}

export function renderTilesets(names: string[]): RenderTileset[] {
  return names.map((name, index) => ({
    firstgid: index * 10 + 1,
    lastgid: index * 10 + 10,
    name,
    spriteName: name,
    tileheight: TILE,
    tilewidth: TILE,
  }));
}

export function squareLayer(data: number[]): TiledTileLayer {
  const side = Math.sqrt(data.length);
  return { data, height: side, type: "tilelayer", width: side };
}

export function addFakeBand(
  layers: TiledTileLayer[],
  tilesets: RenderTileset[],
  options: FakeBandOptions = {},
) {
  const side = layers[0]?.width ?? 1;
  const mapSize = side * TILE;
  const camera = options.camera ?? { x: mapSize / 2, y: mapSize / 2 };
  const scale = options.scale ?? 1;
  let viewport = options.viewport ?? { height: mapSize, width: mapSize };
  const canvases: FakeChunkCanvas[] = [];
  const drawn: string[] = [];
  const quads: FakeQuadOpt[] = [];
  const transforms: FakeMat4[] = [];
  let transform = new FakeMat4();
  let target: FakeChunkCanvas | undefined;
  let draw: (() => void) | undefined;
  let destroy: (() => void) | undefined;

  function toScreen(world: Point, fixed: boolean): Point {
    const point = transform.apply(world);
    if (fixed) return point;
    return {
      x: (point.x - camera.x) * scale + viewport.width / 2,
      y: (point.y - camera.y) * scale + viewport.height / 2,
    };
  }

  // KAPLAY maps a framebuffer's points through the game's size.
  function toTexel(canvas: FakeChunkCanvas, screen: Point): Point {
    return {
      x: (screen.x * canvas.width) / viewport.width,
      y: (screen.y * canvas.height) / viewport.height,
    };
  }

  const drawSprite = vi.fn(({ fixed = false, pos, sprite }: FakeSpriteOpt) => {
    drawn.push(sprite);
    target?.draws.push({
      sprite,
      texel: toTexel(target, toScreen(pos, fixed)),
      world: pos,
    });
  });
  const makeCanvas = vi.fn((width: number, height: number) => {
    const canvas: FakeChunkCanvas & { draw: (action: () => void) => void } = {
      draw(action) {
        target = canvas;
        action();
        target = undefined;
      },
      draws: [],
      fb: { tex: `chunk-${canvases.length}` },
      free: vi.fn(),
      height,
      width,
    };
    canvases.push(canvas);
    return canvas;
  });
  const k = {
    add: (components: Array<{ destroy?: () => void; draw?: () => void }>) => {
      draw = components.find((component) => component.draw)?.draw;
      destroy = components.find((component) => component.destroy)?.destroy;
    },
    drawSprite,
    drawUVQuad: (quad: FakeQuadOpt) => quads.push(quad),
    getCamPos: () => camera,
    getCamScale: () => ({ x: scale, y: scale }),
    height: () => viewport.height,
    layer: (name: string) => ({ name }),
    makeCanvas,
    Mat4: FakeMat4,
    popTransform: () => {
      transform = transforms.pop() ?? transform;
    },
    pushMatrix: (matrix: FakeMat4) => {
      transform = matrix.clone();
    },
    pushScale: (x: number, y: number) => {
      transform.scaleX *= x;
      transform.scaleY *= y;
    },
    pushTransform: () => transforms.push(transform.clone()),
    pushTranslate: (x: number, y: number) => {
      transform.translateX += transform.scaleX * x;
      transform.translateY += transform.scaleY * y;
    },
    vec2: (x: number, y: number) => ({ x, y }),
    width: () => viewport.width,
  } as unknown as KAPLAYCtx;
  const map: CampusTiledMap = {
    height: side,
    layers,
    tileheight: TILE,
    tilesets: [],
    tilewidth: TILE,
    width: side,
  };

  addMapBand(k, {
    chunkSize: options.chunkSize,
    layer: "below",
    layers,
    map,
    onDraw: options.onDraw,
    tilesets,
  });

  return {
    canvases: () => canvases,
    destroy: () => destroy?.(),
    drawFrame() {
      drawn.length = 0;
      quads.length = 0;
      draw?.();
      return [...drawn];
    },
    drawSprite,
    makeCanvas,
    quads: () => [...quads],
    resize(size: Size) {
      viewport = size;
    },
  };
}
