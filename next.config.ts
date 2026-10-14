import type { NextConfig } from "next";

import { buildEnvironment } from "./config/environment/build";
import { validateBuildEnvironment } from "./config/environment/validation";

validateBuildEnvironment(buildEnvironment);

const nextConfig = {
  typedRoutes: true,
  experimental: {
    authInterrupts: true,
  },
} satisfies NextConfig;

export default nextConfig;
