"use client";

import { createCampusApi } from "./create-campus-api";

export const campusBrowserApi = createCampusApi({
  baseUrl: "/api/campus",
});
