import { z } from "zod";

import type { components } from "../client";

type Schemas = components["schemas"];

export const sessionScopeSchema = z.toZod<Schemas["SessionScope"]>()(
  z.enum(["provisional", "full_access"]),
);

export const systemRoleSchema = z.toZod<Schemas["SystemRole"]>()(
  z.enum(["user", "admin", "super_admin"]),
);

export const cohortRoleSchema = z.toZod<Schemas["CohortRole"]>()(
  z.enum(["student", "professor", "mentor", "guest"]),
);
