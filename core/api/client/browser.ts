"use client";

import { createApiClient } from "./create-api-client";

export const browserApi = createApiClient({
  baseUrl: "/api",
});
