// Relative, with .ts: `pnpm api:types` runs this file in plain Node.
import {
  isLoopbackHttp,
  isRailwayPrivate,
  parseBareOrigin,
} from "../../../shared/lib/parse-origin.ts";

type ApiEnvironment = Readonly<Record<string, string | undefined>>;

const INVALID_ORIGIN_MESSAGE =
  "API_BASE_URL must be an HTTPS, loopback HTTP, or Railway private HTTP origin.";

function isAllowedApiOrigin(url: URL): boolean {
  return (
    url.protocol === "https:" ||
    isLoopbackHttp(url) ||
    (url.protocol === "http:" && isRailwayPrivate(url))
  );
}

export function readApiBaseUrl(
  environment: ApiEnvironment = process.env,
): string {
  const configuredBaseUrl = environment.API_BASE_URL?.trim();

  if (!configuredBaseUrl) {
    throw new Error("API_BASE_URL is required.");
  }

  const url = parseBareOrigin(configuredBaseUrl);

  if (!url || !isAllowedApiOrigin(url)) {
    throw new Error(INVALID_ORIGIN_MESSAGE);
  }

  return url.origin;
}

export function readOpenApiUrl(
  environment: ApiEnvironment = process.env,
): string {
  return new URL("/docs-json", readApiBaseUrl(environment)).href;
}
