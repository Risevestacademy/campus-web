import { publicEnvironment } from "@/config/environment/public";
import {
  isLoopbackHttp,
  isRailwayPrivate,
  parseBareOrigin,
} from "@/shared/lib/parse-origin";

type SiteEnvironment = Readonly<Record<string, string | undefined>>;

export const SITE_NAME = "Campus by Rise";
export const SITE_DESCRIPTION =
  "A persistent digital campus for learning, collaboration, and community at Rise.";

const INVALID_ORIGIN_MESSAGE =
  "NEXT_PUBLIC_SITE_URL must be a public HTTPS or loopback HTTP origin.";

function isServedOrigin(url: URL): boolean {
  return (
    (url.protocol === "https:" && !isRailwayPrivate(url)) || isLoopbackHttp(url)
  );
}

// Unset means this deployment is not the public site, so search engines are
// kept out. A malformed value throws: silently treating it as unset would
// deindex production.
export function parseSiteOrigin(environment: SiteEnvironment): URL | undefined {
  const configuredOrigin = environment.NEXT_PUBLIC_SITE_URL?.trim();

  if (!configuredOrigin) {
    return undefined;
  }

  const url = parseBareOrigin(configuredOrigin);

  if (!url || !isServedOrigin(url)) {
    throw new Error(INVALID_ORIGIN_MESSAGE);
  }

  return url;
}

export function readSiteOrigin(): URL | undefined {
  return parseSiteOrigin(publicEnvironment);
}
