import { z } from "zod";

import type { CampusTiledMap } from "../services/map/load-campus-map";

const positiveInt = z.int().positive();
// Tiled stores flip flags in the top three bits, so a gid spans all 32.
const gid = z.int().min(0).max(0xffff_ffff);

const tileLayerSchema = z
  .object({
    type: z.literal("tilelayer"),
    data: z.array(gid),
    width: positiveInt,
    height: positiveInt,
    name: z.string().optional(),
    offsetx: z.number().optional(),
    offsety: z.number().optional(),
    opacity: z.number().min(0).max(1).optional(),
    visible: z.boolean().optional(),
  })
  .refine((layer) => layer.data.length === layer.width * layer.height);

const otherLayerSchema = z.object({
  type: z.enum(["objectgroup", "imagelayer"]),
  name: z.string().optional(),
  visible: z.boolean().optional(),
});

const groupLayerSchema = z.object({
  type: z.literal("group"),
  name: z.string().optional(),
  visible: z.boolean().optional(),
  get layers(): z.ZodArray<typeof layerSchema> {
    return z.array(layerSchema);
  },
});

const layerSchema = z.discriminatedUnion("type", [
  tileLayerSchema,
  groupLayerSchema,
  otherLayerSchema,
]);

const tilesetSchema = z.object({
  firstgid: positiveInt,
  image: z.string(),
  name: z.string(),
  columns: positiveInt,
  tilecount: positiveInt,
  imagewidth: positiveInt,
  imageheight: positiveInt,
  tilewidth: positiveInt,
  tileheight: positiveInt,
  margin: z.int().min(0),
  spacing: z.int().min(0),
  tileoffset: z
    .object({ x: z.number().optional(), y: z.number().optional() })
    .optional(),
});

const campusTiledMapSchema = z.object({
  width: positiveInt,
  height: positiveInt,
  tilewidth: positiveInt,
  tileheight: positiveInt,
  layers: z.array(layerSchema),
  tilesets: z.array(tilesetSchema),
});

export function parseCampusTiledMap(
  value: unknown,
): CampusTiledMap | undefined {
  return campusTiledMapSchema.safeParse(value).data;
}
