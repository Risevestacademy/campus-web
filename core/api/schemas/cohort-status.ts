import { z } from "zod";

import type { components } from "../client";

export const cohortStatusSchema = z.toZod<
  components["schemas"]["CohortStatus"]
>()(z.enum(["upcoming", "active", "completed"]));
