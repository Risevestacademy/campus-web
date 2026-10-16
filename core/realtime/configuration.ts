// Relative, with .ts: `pnpm world:types` runs this file in plain Node.
import {
  isLoopbackHttp,
  isRailwayPrivate,
  parseBareOrigin,
} from "../../shared/lib/parse-origin.ts";

type WorldEnvironment = Readonly<Record<string, string | undefined>>;

const INVALID_ORIGIN_MESSAGE =
  "NEXT_PUBLIC_WORLD_URL must be a public HTTPS or loopback HTTP origin.";

// The browser opens the socket, so a Railway private host is unreachable.
function isBrowserReachable(url: URL): boolean {
  return (
    !isRailwayPrivate(url) && (url.protocol === "https:" || isLoopbackHttp(url))
  );
}

export function readWorldOrigin(environment: WorldEnvironment): string {
  const configuredOrigin = environment.NEXT_PUBLIC_WORLD_URL?.trim();

  if (!configuredOrigin) {
    throw new Error("NEXT_PUBLIC_WORLD_URL is required.");
  }

  const url = parseBareOrigin(configuredOrigin);

  if (!url || !isBrowserReachable(url)) {
    throw new Error(INVALID_ORIGIN_MESSAGE);
  }

  return url.origin;
}

export function readWorldSchemaUrl(environment: WorldEnvironment): string {
  return new URL("/schema.json", readWorldOrigin(environment)).href;
}
