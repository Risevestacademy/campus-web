import { type BrowserContext, expect, type Page } from "@playwright/test";

import { installSanityMapStub } from "./sanity-stub";

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

export const JOINED_ELSEWHERE = "You're in this cohort in another tab";
export const TAKEN_OVER = "You joined from another tab";

export function presenceTabChoice(page: Page, heading: string) {
  return page.getByRole("heading", { name: heading });
}

// Not `useHere…`: the hooks lint rule would read it as a React hook.
export function moveHereButton(page: Page) {
  return page.getByRole("button", { name: "Use here" });
}

export async function openSecondTab(context: BrowserContext) {
  const secondPage = await context.newPage();
  await installSanityMapStub(secondPage);
  return secondPage;
}
