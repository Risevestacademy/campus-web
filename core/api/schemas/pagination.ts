import { z } from "zod";

import type { components } from "../client";
import type { Simplify } from "./simplify";

type PaginationMeta = Simplify<
  Pick<components["schemas"]["PaginationMetaDto"], "page" | "totalPages">
>;

export const paginationMetaSchema = z.toZod<PaginationMeta>()(
  z.object({
    page: z.number().int().positive(),
    totalPages: z.number().int().nonnegative(),
  }),
);
