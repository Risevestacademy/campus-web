const CAMPUS_HOME_PATH = "/campus";
const RETURN_ROOTS = [CAMPUS_HOME_PATH, "/invitation", "/preview"] as const;
const PRE_JOIN_SEGMENT = "join";
const MAX_RETURN_TO_LENGTH = 2048;
// Only used to serialize a path that already passed validation.
const PARSING_ORIGIN = "https://campus.invalid";
const DOT_SEGMENTS = new Set([".", ".."]);
const UNSAFE_CHARACTERS = /[\\\u0000-\u001f\u007f]/u;

function decodeSegment(segment: string): string | undefined {
  try {
    return decodeURIComponent(segment);
  } catch {
    return undefined;
  }
}

// Inspected before URL parsing: the parser resolves dot segments silently, so
// "/campus/42/../43" would otherwise arrive looking like a clean campus path.
function isSafeSegment(segment: string, isLast: boolean): boolean {
  if (segment === "") return isLast;

  const decoded = decodeSegment(segment);
  return (
    decoded !== undefined &&
    !DOT_SEGMENTS.has(decoded) &&
    !decoded.includes("/") &&
    !UNSAFE_CHARACTERS.test(decoded)
  );
}

function isUnderReturnRoot(path: string): boolean {
  return RETURN_ROOTS.some(
    (root) => path === root || path.startsWith(`${root}/`),
  );
}

function isReturnPath(path: string): boolean {
  if (!isUnderReturnRoot(path)) return false;

  const segments = path.split("/").slice(1);
  return segments.every((segment, index) =>
    isSafeSegment(segment, index === segments.length - 1),
  );
}

export function parseReturnTo(value: string | undefined): string | undefined {
  if (!value || value.length > MAX_RETURN_TO_LENGTH) return undefined;
  if (UNSAFE_CHARACTERS.test(value)) return undefined;

  const [withoutFragment = ""] = value.split("#", 1);
  const [path = ""] = withoutFragment.split("?", 1);
  if (!isReturnPath(path)) return undefined;

  const url = new URL(withoutFragment, PARSING_ORIGIN);
  return `${url.pathname}${url.search}`;
}

export function normalizeReturnTo(value: string | undefined): string {
  return parseReturnTo(value) ?? CAMPUS_HOME_PATH;
}

// Active campus: /campus/{id} and everything under it except /campus/{id}/join.
export function activeCampusCohort(pathname: string): string | undefined {
  const [root, campus, cohortSegment, section] = pathname.split("/");
  if (root !== "" || `/${campus}` !== CAMPUS_HOME_PATH || !cohortSegment) {
    return undefined;
  }

  const isPreJoin =
    section !== undefined && decodeSegment(section) === PRE_JOIN_SEGMENT;
  return isPreJoin ? undefined : decodeSegment(cohortSegment);
}

export function normalizeCohortReturnTo(
  cohortId: string,
  value: string | undefined,
): string {
  const destination = parseReturnTo(value);
  const [pathname = ""] = destination?.split("?", 1) ?? [];

  return destination && activeCampusCohort(pathname) === cohortId
    ? destination
    : `${CAMPUS_HOME_PATH}/${encodeURIComponent(cohortId)}`;
}
