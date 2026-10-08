export type AdministrationView = "cohorts" | "tracks";
export interface AdministrationQuery {
  view: AdministrationView;
  page: number;
}

const POSITIVE_INTEGER = /^[1-9]\d*$/;

export function parseAdministrationQuery(
  view: string | undefined,
  page: string | undefined,
): AdministrationQuery {
  if (
    (view !== undefined && view !== "cohorts" && view !== "tracks") ||
    (page !== undefined && !POSITIVE_INTEGER.test(page))
  ) {
    return { view: "cohorts", page: 1 };
  }
  const parsedPage = page === undefined ? 1 : Number(page);
  return Number.isSafeInteger(parsedPage)
    ? { view: view === "tracks" ? "tracks" : "cohorts", page: parsedPage }
    : { view: "cohorts", page: 1 };
}
