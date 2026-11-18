const LOOPBACK_HOSTNAMES = ["localhost", "127.0.0.1", "[::1]"];
const RAILWAY_PRIVATE_SUFFIX = ".railway.internal";

export function parseBareOrigin(value: string): URL | undefined {
  let url: URL;

  try {
    url = new URL(value);
  } catch {
    return undefined;
  }

  const isBareOrigin =
    !url.username &&
    !url.password &&
    url.pathname === "/" &&
    !url.search &&
    !url.hash;

  return isBareOrigin ? url : undefined;
}

export function isLoopbackHost(url: URL): boolean {
  return LOOPBACK_HOSTNAMES.includes(url.hostname);
}

export function isLoopbackHttp(url: URL): boolean {
  return url.protocol === "http:" && isLoopbackHost(url);
}

// URL keeps a trailing dot, and "host.railway.internal." resolves the same.
export function isRailwayPrivate(url: URL): boolean {
  return url.hostname.replace(/\.$/, "").endsWith(RAILWAY_PRIVATE_SUFFIX);
}
