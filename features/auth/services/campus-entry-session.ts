const CAMPUS_ENTRY_COOKIE_PREFIX = "campus_entry_";
const CAMPUS_ENTRY_COOKIE_VALUE = "1";
const CAMPUS_ENTRY_COOKIE_PATH = "/campus";
// Markers set before entry moved under /campus live at the root path; logout
// expires both so the migration leaves no stale entry behind.
const EXPIRED_CAMPUS_ENTRY_COOKIE_PATHS = [CAMPUS_ENTRY_COOKIE_PATH, "/"];

interface CookieReader {
  get(name: string): { value: string } | undefined;
}

interface CookieCollection {
  getAll(): Array<{ name: string; value: string }>;
}

// Cookie names are RFC 6265 tokens; encodeURIComponent leaves the "(" and ")"
// separators unescaped.
function encodeCookieToken(value: string): string {
  return encodeURIComponent(value)
    .replaceAll("(", "%28")
    .replaceAll(")", "%29");
}

export function campusEntryCookieName(cohortId: string): string {
  return `${CAMPUS_ENTRY_COOKIE_PREFIX}${encodeCookieToken(cohortId)}`;
}

export function hasCampusEntry(
  cookies: CookieReader,
  cohortId: string,
): boolean {
  return (
    cookies.get(campusEntryCookieName(cohortId))?.value ===
    CAMPUS_ENTRY_COOKIE_VALUE
  );
}

export function isCampusEntryCookie(name: string): boolean {
  return name.startsWith(CAMPUS_ENTRY_COOKIE_PREFIX);
}

export function enteredCampusIds(cookies: CookieCollection): string[] {
  const cohortIds: string[] = [];

  for (const { name, value } of cookies.getAll()) {
    if (!isCampusEntryCookie(name) || value !== CAMPUS_ENTRY_COOKIE_VALUE) {
      continue;
    }

    try {
      cohortIds.push(
        decodeURIComponent(name.slice(CAMPUS_ENTRY_COOKIE_PREFIX.length)),
      );
    } catch {
      // Ignore malformed client-controlled cookie names.
    }
  }

  return cohortIds;
}

function cookieAttributes(path: string, secure: boolean): string[] {
  return [`Path=${path}`, "SameSite=Lax", ...(secure ? ["Secure"] : [])];
}

export function serializeCampusEntryCookie(
  cohortId: string,
  secure: boolean,
): string {
  return [
    `${campusEntryCookieName(cohortId)}=${CAMPUS_ENTRY_COOKIE_VALUE}`,
    ...cookieAttributes(CAMPUS_ENTRY_COOKIE_PATH, secure),
  ].join("; ");
}

export function serializeExpiredCampusEntryCookies(
  name: string,
  secure: boolean,
): string[] {
  return EXPIRED_CAMPUS_ENTRY_COOKIE_PATHS.map((path) =>
    [`${name}=`, ...cookieAttributes(path, secure), "Max-Age=0"].join("; "),
  );
}
