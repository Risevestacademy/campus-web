import { expect, type Page } from "@playwright/test";

export function preJoinUrl(activePath: string): string {
  const [, cohortSegment] = /^\/campus\/([^/?]+)/.exec(activePath) ?? [];
  if (!cohortSegment)
    throw new Error(`Not an active campus path: ${activePath}`);

  const search = new URLSearchParams({ returnTo: activePath });
  return `/campus/${cohortSegment}/join?${search.toString()}`;
}

export function joinButton(page: Page) {
  return page.getByRole("button", { name: "Join", exact: true });
}

// Enter through the preparation route, then soft-navigate with Join.
export async function enterCampus(page: Page, activePath: string) {
  await page.goto(preJoinUrl(activePath));
  await joinButton(page).click();
  await expect(page).toHaveURL(activePath);
}
