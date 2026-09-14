import createClient, { type ClientOptions } from "openapi-fetch";

import type { paths } from "./generated/schema";

export interface CampusApiConfiguration {
  baseUrl: string;
  fetch?: ClientOptions["fetch"];
  headers?: ClientOptions["headers"];
}

function removeTrailingSlashes(baseUrl: string): string {
  return baseUrl.replace(/\/+$/u, "");
}

export function createCampusApi({
  baseUrl,
  ...requestDefaults
}: CampusApiConfiguration) {
  return createClient<paths>({
    ...requestDefaults,
    baseUrl: removeTrailingSlashes(baseUrl),
  });
}

export type CampusApi = ReturnType<typeof createCampusApi>;
