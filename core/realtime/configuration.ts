type WorldEnvironment = Readonly<Record<string, string | undefined>>;

const INVALID_ORIGIN_MESSAGE =
  "NEXT_PUBLIC_WORLD_URL must be an HTTPS or loopback HTTP origin.";

function isAllowedProtocol(url: URL): boolean {
  const isHttps = url.protocol === "https:";
  const isLoopbackHttp =
    url.protocol === "http:" &&
    ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);

  return isHttps || isLoopbackHttp;
}

function parseWorldOrigin(value: string): URL {
  let url: URL;

  try {
    url = new URL(value);
  } catch {
    throw new Error(INVALID_ORIGIN_MESSAGE);
  }

  const isOrigin =
    isAllowedProtocol(url) &&
    !url.username &&
    !url.password &&
    url.pathname === "/" &&
    !url.search &&
    !url.hash;

  if (!isOrigin) {
    throw new Error(INVALID_ORIGIN_MESSAGE);
  }

  return url;
}

export function readWorldOrigin(
  environment: WorldEnvironment = process.env,
): string {
  const configuredOrigin = environment.NEXT_PUBLIC_WORLD_URL?.trim();

  if (!configuredOrigin) {
    throw new Error("NEXT_PUBLIC_WORLD_URL is required.");
  }

  return parseWorldOrigin(configuredOrigin).origin;
}

export function readWorldSchemaUrl(
  environment: WorldEnvironment = process.env,
): string {
  return new URL("/schema.json", readWorldOrigin(environment)).href;
}
