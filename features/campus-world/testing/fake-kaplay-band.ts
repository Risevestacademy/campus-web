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
  angle?: number;
  fixed?: boolean;
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
  footprint: Size;
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

// KAPLAY's Mat4 in 2D, column-major: translate and scale post-multiply, but
// rotate multiplies on the left.
class FakeMat4 {
  constructor(
    public xx = 1,
    public xy = 0,
    public yx = 0,
    public yy = 1,
    public tx = 0,
    public ty = 0,
  ) {}

  apply({ x, y }: Point): Point {
    return {
      x: this.xx * x + this.yx * y + this.tx,
      y: this.xy * x + this.yy * y + this.ty,
    };
  }

  clone(): FakeMat4 {
    return new FakeMat4(this.xx, this.xy, this.yx, this.yy, this.tx, this.ty);
  }

  rotate(degrees: number) {
    const radians = (-degrees * Math.PI) / 180;
    const cos = Math.cos(radians);
    const sin = Math.sin(radians);
    const { xx, xy, yx, yy } = this;
    this.xx = xx * cos + xy * sin;
    this.xy = -xx * sin + xy * cos;
    this.yx = yx * cos + yy * sin;
    this.yy = -yx * sin + yy * cos;
  }

  scale(x: number, y: number) {
    this.xx *= x;
    this.xy *= x;
    this.yx *= y;
    this.yy *= y;
  }

  translate(x: number, y: number) {
    this.tx += this.xx * x + this.yx * y;
    this.ty += this.xy * x + this.yy * y;
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
  const camera = { ...(options.camera ?? { x: mapSize / 2, y: mapSize / 2 }) };
  const scale = options.scale ?? 1;
  const gfx = { ...(options.viewport ?? { height: mapSize, width: mapSize }) };
  const canvases: FakeChunkCanvas[] = [];
  const drawn: string[] = [];
  const quads: FakeQuadOpt[] = [];
  const transforms: FakeMat4[] = [];
  let transform = new FakeMat4();
  let target: FakeChunkCanvas | undefined;
  let draw: (() => void) | undefined;
  let destroy: (() => void) | undefined;

  function spriteSize(sprite: string): Size {
    const tileset = tilesets.find(({ spriteName }) => spriteName === sprite)!;
    return { height: tileset.tileheight, width: tileset.tilewidth };
  }

  function toScreen(point: Point, fixed: boolean): Point {
    if (fixed) return point;
    return {
      x: (point.x - camera.x) * scale + gfx.width / 2,
      y: (point.y - camera.y) * scale + gfx.height / 2,
    };
  }

  // KAPLAY maps a framebuffer's points through the game's size.
  function toTexel(canvas: FakeChunkCanvas, screen: Point): Point {
    return {
      x: (screen.x * canvas.width) / gfx.width,
      y: (screen.y * canvas.height) / gfx.height,
    };
  }

  // drawSprite with a centre anchor, as KAPLAY's drawUVQuad transforms it.
  function bakedDraw(
    canvas: FakeChunkCanvas,
    { angle = 0, fixed = false, pos, sprite }: FakeSpriteOpt,
  ): BakedDraw {
    const quad = transform.clone();
    quad.translate(pos.x, pos.y);
    quad.rotate(angle);
    const { height, width } = spriteSize(sprite);
    const corners = [
      { x: -width / 2, y: -height / 2 },
      { x: width / 2, y: height / 2 },
    ].map((corner) => toTexel(canvas, toScreen(quad.apply(corner), fixed)));

    return {
      footprint: {
        height: Math.abs(corners[1]!.y - corners[0]!.y),
        width: Math.abs(corners[1]!.x - corners[0]!.x),
      },
      sprite,
      texel: toTexel(canvas, toScreen(transform.apply(pos), fixed)),
      world: pos,
    };
  }

  const drawSprite = vi.fn((sprite: FakeSpriteOpt) => {
    drawn.push(sprite.sprite);
    if (target) target.draws.push(bakedDraw(target, sprite));
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
    _k: { gfx },
    add: (components: Array<{ destroy?: () => void; draw?: () => void }>) => {
      draw = components.find((component) => component.draw)?.draw;
      destroy = components.find((component) => component.destroy)?.destroy;
    },
    drawSprite,
    drawUVQuad: (quad: FakeQuadOpt) => quads.push(quad),
    getCamPos: () => camera,
    getCamScale: () => ({ x: scale, y: scale }),
    height: () => gfx.height,
    layer: (name: string) => ({ name }),
    makeCanvas,
    Mat4: FakeMat4,
    popTransform: () => {
      transform = transforms.pop() ?? transform;
    },
    pushMatrix: (matrix: FakeMat4) => {
      transform = matrix.clone();
    },
    pushScale: (x: number, y: number) => transform.scale(x, y),
    pushTransform: () => transforms.push(transform.clone()),
    pushTranslate: (x: number, y: number) => transform.translate(x, y),
    vec2: (x: number, y: number) => ({ x, y }),
    width: () => gfx.width,
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
    gameSize: () => ({ height: gfx.height, width: gfx.width }),
    makeCanvas,
    panTo(point: Point) {
      Object.assign(camera, point);
    },
    quads: () => [...quads],
  };
}
