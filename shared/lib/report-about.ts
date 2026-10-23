export interface ReportAbout {
  reported: string | undefined;
  where: string | undefined;
}

const SEPARATOR = "|";

// campus-api has one free-text `about` field. A report packs who is reported
// and where into it as "Who | Where"; a bar typed in the name becomes "/" so
// the first bar is always the separator.
export function packReportAbout({
  reported,
  where,
}: {
  reported: string;
  where: string;
}): string {
  return `${reported.replaceAll(SEPARATOR, "/")} ${SEPARATOR} ${where}`.trim();
}

// An `about` without a separator is read as the name alone.
export function splitReportAbout(about: string | null): ReportAbout {
  if (!about) return { reported: undefined, where: undefined };

  const separator = about.indexOf(SEPARATOR);
  const reported = (
    separator === -1 ? about : about.slice(0, separator)
  ).trim();
  const where = separator === -1 ? "" : about.slice(separator + 1).trim();

  return { reported: reported || undefined, where: where || undefined };
}
