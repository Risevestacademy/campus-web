import type { NextConfig } from "next";

import { buildEnvironment } from "./config/environment/build";
import { validateBuildEnvironment } from "./config/environment/validation";

validateBuildEnvironment(buildEnvironment);

const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "cdn.sanity.io",
        port: "",
        pathname: "/media-libraries/mlu3DBU0QaKb/images/**",
        search: "",
      },
    ],
  },
  typedRoutes: true,
} satisfies NextConfig;

export default nextConfig;
