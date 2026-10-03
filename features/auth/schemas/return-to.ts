const CAMPUS_HOME_PATH = "/campus";
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

function isCampusPath(path: string): boolean {
  if (path !== CAMPUS_HOME_PATH && !path.startsWith(`${CAMPUS_HOME_PATH}/`)) {
    return false;
  }

  const segments = path.split("/").slice(1);
  return segments.every((segment, index) =>
    isSafeSegment(segment, index === segments.length - 1),
  );
}

export function parseCampusReturnTo(
  value: string | undefined,
): string | undefined {
  if (!value || value.length > MAX_RETURN_TO_LENGTH) return undefined;
  if (UNSAFE_CHARACTERS.test(value)) return undefined;

  const [withoutFragment = ""] = value.split("#", 1);
  const [path = ""] = withoutFragment.split("?", 1);
  if (!isCampusPath(path)) return undefined;

  const url = new URL(withoutFragment, PARSING_ORIGIN);
  return `${url.pathname}${url.search}`;
}

export function normalizeCampusReturnTo(value: string | undefined): string {
  return parseCampusReturnTo(value) ?? CAMPUS_HOME_PATH;
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
  const destination = parseCampusReturnTo(value);
  const [pathname = ""] = destination?.split("?", 1) ?? [];

  return destination && activeCampusCohort(pathname) === cohortId
    ? destination
    : `${CAMPUS_HOME_PATH}/${encodeURIComponent(cohortId)}`;
}
