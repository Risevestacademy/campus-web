import { expect, type Page } from "@playwright/test";

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

// Hard loads of an active campus always stop at pre-join, so tests enter the
// way a visitor does: open /join, then soft-navigate with Join.
export async function enterCampus(page: Page, activePath: string) {
  await page.goto(preJoinUrl(activePath));
  await joinLink(page).click();
  await expect(page).toHaveURL(activePath);
}
