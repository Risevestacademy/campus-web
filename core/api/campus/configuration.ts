type CampusApiEnvironment = Readonly<Record<string, string | undefined>>;

const INVALID_ORIGIN_MESSAGE =
  "CAMPUS_API_BASE_URL must be an HTTPS origin or a Railway private HTTP origin.";

function isAllowedProtocol(url: URL): boolean {
  const isHttps = url.protocol === "https:";
  const isRailwayPrivateHttp =
    url.protocol === "http:" && url.hostname.endsWith(".railway.internal");

  return isHttps || isRailwayPrivateHttp;
}

function parseCampusApiOrigin(value: string): URL {
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

export function readCampusApiBaseUrl(
  environment: CampusApiEnvironment = process.env,
): string {
  const configuredBaseUrl = environment.CAMPUS_API_BASE_URL?.trim();

  if (!configuredBaseUrl) {
    throw new Error("CAMPUS_API_BASE_URL is required.");
  }

  return parseCampusApiOrigin(configuredBaseUrl).origin;
}

export function readCampusOpenApiUrl(
  environment: CampusApiEnvironment = process.env,
): string {
  return new URL("/docs-json", readCampusApiBaseUrl(environment)).href;
}
