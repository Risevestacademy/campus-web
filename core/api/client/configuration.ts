type ApiEnvironment = Readonly<Record<string, string | undefined>>;

const INVALID_ORIGIN_MESSAGE =
  "API_BASE_URL must be an HTTPS origin or a Railway private HTTP origin.";

function isAllowedProtocol(url: URL): boolean {
  const isHttps = url.protocol === "https:";
  const isRailwayPrivateHttp =
    url.protocol === "http:" && url.hostname.endsWith(".railway.internal");

  return isHttps || isRailwayPrivateHttp;
}

function parseApiOrigin(value: string): URL {
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

export function readApiBaseUrl(
  environment: ApiEnvironment = process.env,
): string {
  const configuredBaseUrl = environment.API_BASE_URL?.trim();

  if (!configuredBaseUrl) {
    throw new Error("API_BASE_URL is required.");
  }

  return parseApiOrigin(configuredBaseUrl).origin;
}

export function readOpenApiUrl(
  environment: ApiEnvironment = process.env,
): string {
  return new URL("/docs-json", readApiBaseUrl(environment)).href;
}
