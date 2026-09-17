import { defineRailway } from "railway/iac";

import { createFrontendProject } from "./stack.ts";

export const partial = "campus-frontends";

export default defineRailway(() => createFrontendProject("staging"));
