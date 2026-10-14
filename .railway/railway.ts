import { defineRailway } from "railway/iac";

import { createFrontendProject } from "./stack.ts";

export const partial = "campus-frontends";

export default defineRailway((context) => {
  if (context.isEnvironment("staging")) {
    return createFrontendProject("staging");
  }

  if (context.isEnvironment("production")) {
    return createFrontendProject("production");
  }

  throw new Error(
    `Unsupported Railway environment: ${context.environment ?? "unknown"}`,
  );
});
