import { type BrowserContext, expect, type Page } from "@playwright/test";

export function preJoinUrl(activePath: string): string {
  const [, cohortSegment] = /^\/campus\/([^/?]+)/.exec(activePath) ?? [];
  if (!cohortSegment)
    throw new Error(`Not an active campus path: ${activePath}`);

  const search = new URLSearchParams({ returnTo: activePath });
  return `/campus/${cohortSegment}/join?${search.toString()}`;
}

export function joinLink(page: Page) {
  return page.getByRole("link", { name: "Join", exact: true });
}

// A campus without a browser-session entry marker stops at pre-join, so tests
// enter the way a visitor does: open /join, then soft-navigate with Join.
export async function enterCampus(page: Page, activePath: string) {
  await page.goto(preJoinUrl(activePath));
  await joinLink(page).click();
  await expect(page).toHaveURL(activePath);
}

// Seeds the marker Join records, for tests about what happens after entry.
export async function rememberCampusEntry(
  context: BrowserContext,
  baseURL: string | undefined,
  cohortId: string,
) {
  await context.addCookies([
    {
      name: `campus_entry_${cohortId}`,
      value: "1",
      domain: new URL(baseURL ?? "http://127.0.0.1").hostname,
      path: "/campus",
      sameSite: "Lax",
    },
  ]);
}
