import createClient, { type ClientOptions } from "openapi-fetch";

import type { paths } from "./generated/schema";

export interface ApiClientConfiguration {
  baseUrl: string;
  fetch?: ClientOptions["fetch"];
  headers?: ClientOptions["headers"];
}

function removeTrailingSlashes(baseUrl: string): string {
  return baseUrl.replace(/\/+$/u, "");
}

export function createApiClient({
  baseUrl,
  ...requestDefaults
}: ApiClientConfiguration) {
  return createClient<paths>({
    ...requestDefaults,
    baseUrl: removeTrailingSlashes(baseUrl),
  });
}

export type ApiClient = ReturnType<typeof createApiClient>;
