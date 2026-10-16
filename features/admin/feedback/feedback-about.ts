export interface ReportAbout {
  reported: string | undefined;
  where: string | undefined;
}

// campus-api has one free-text `about` field. The Feedback popup packs a
// report's "who" and "where" into it as "Who | Where", so split on the first
// "|". An `about` without one is read as the name alone.
export function splitReportAbout(about: string | null): ReportAbout {
  if (!about) return { reported: undefined, where: undefined };

  const separator = about.indexOf("|");
  const reported = (
    separator === -1 ? about : about.slice(0, separator)
  ).trim();
  const where = separator === -1 ? "" : about.slice(separator + 1).trim();

  return { reported: reported || undefined, where: where || undefined };
}
