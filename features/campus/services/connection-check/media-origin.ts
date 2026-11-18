import {
  isLoopbackHost,
  isRailwayPrivate,
  parseBareOrigin,
} from "@/shared/lib/parse-origin";

type MediaEnvironment = Readonly<Record<string, string | undefined>>;

const INVALID_ORIGIN_MESSAGE =
  "NEXT_PUBLIC_MEDIA_URL must be a public WSS or loopback WS origin.";

function isBrowserReachable(url: URL): boolean {
  return (
    !isRailwayPrivate(url) &&
    (url.protocol === "wss:" || (url.protocol === "ws:" && isLoopbackHost(url)))
  );
}

// Unset means this deployment has no media server: the check stays hidden.
export function readMediaOrigin(
  environment: MediaEnvironment,
): string | undefined {
  const configuredOrigin = environment.NEXT_PUBLIC_MEDIA_URL?.trim();

  if (!configuredOrigin) {
    return undefined;
  }

  const url = parseBareOrigin(configuredOrigin);

  if (!url || !isBrowserReachable(url)) {
    throw new Error(INVALID_ORIGIN_MESSAGE);
  }

  return url.origin;
}

export function pinMediaUrl(
  url: string,
  mediaOrigin: string,
): string | undefined {
  const origin = parseBareOrigin(url)?.origin;

  return origin === mediaOrigin ? origin : undefined;
}
