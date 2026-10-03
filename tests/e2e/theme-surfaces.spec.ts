import {
  type BrowserContext,
  expect,
  type Locator,
  type Page,
} from "@playwright/test";

import { enterCampus } from "./support/campus-entry";
import {
  type FakeApi,
  membership,
  sessions,
  signIn,
  test,
} from "./support/fake-api-fixture";

type Theme = "light" | "dark";
type SurfaceRole = "background" | "surface" | "surface-elevated";

const THEME_STORAGE_KEY = "campus-theme";

const expectedColors: Record<Theme, Record<SurfaceRole, string>> = {
  light: {
    background: "rgb(247, 247, 247)",
    surface: "rgb(240, 240, 240)",
    "surface-elevated": "rgb(245, 246, 250)",
  },
  dark: {
    background: "rgb(37, 37, 37)",
    surface: "rgb(51, 51, 51)",
    "surface-elevated": "rgb(69, 69, 69)",
  },
};

const routeCases: ReadonlyArray<{
  path: string;
  roles: readonly SurfaceRole[];
}> = [
  { path: "/", roles: ["background"] },
  { path: "/campus", roles: ["background", "surface"] },
  {
    path: "/campus/c-1",
    roles: ["background", "surface-elevated"],
  },
  { path: "/invitation", roles: ["background"] },
];

const usesFakeApi = !process.env.PLAYWRIGHT_BASE_URL;

function isCampusRoute(path: string): boolean {
  return path === "/campus" || path.startsWith("/campus/");
}

function isProtectedRoute(path: string): boolean {
  return isCampusRoute(path) || path === "/invitation";
}

function isActiveCampusRoute(path: string): boolean {
  return path.startsWith("/campus/");
}

// Enter protected routes as a member with two cohorts and a pending invite:
// /campus shows the chooser instead of redirecting to a single cohort, and
// /invitation renders instead of redirecting to Campus.
async function enterAsInvitedMember(
  context: BrowserContext,
  baseURL: string | undefined,
  fakeApi: FakeApi,
) {
  await signIn(context, baseURL);
  await fakeApi.scriptSession(
    sessions.invitedMember(
      membership("c-1", "Cohort 1"),
      membership("c-2", "Cohort 2"),
    ),
  );
}

async function openWithTheme(page: Page, path: string, theme: Theme) {
  await page.addInitScript(
    ({ storageKey, initialTheme }) => {
      window.localStorage.setItem(storageKey, initialTheme);
    },
    { storageKey: THEME_STORAGE_KEY, initialTheme: theme },
  );

  if (isActiveCampusRoute(path)) {
    await enterCampus(page, path);
  } else {
    const response = await page.goto(path);
    expect(response?.status()).toBe(200);
  }
  await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
}

function surfaces(page: Page, role: SurfaceRole): Locator {
  return page.locator(`[data-surface-role="${role}"]`);
}

async function expectSurfaceHierarchy(
  page: Page,
  roles: readonly SurfaceRole[],
  theme: Theme,
) {
  for (const role of roles) {
    const elements = surfaces(page, role);
    await expect(elements).not.toHaveCount(0);

    const count = await elements.count();
    for (let index = 0; index < count; index += 1) {
      const element = elements.nth(index);
      await expect(element).toBeVisible();
      await expect(element).toHaveCSS(
        "background-color",
        expectedColors[theme][role],
      );
    }
  }
}

const protectedCases = routeCases.filter(({ path }) => isProtectedRoute(path));
const publicCases = routeCases.filter(({ path }) => !isProtectedRoute(path));

for (const theme of ["light", "dark"] as const) {
  for (const { path, roles } of publicCases) {
    test(`${path} resolves the ${theme} surface hierarchy`, async ({
      page,
    }) => {
      await openWithTheme(page, path, theme);
      await expectSurfaceHierarchy(page, roles, theme);
    });
  }
}

// Declared at describe level so the skip happens before the fakeApi fixture
// tries to reach a fake API that remote runs do not start.
test.describe("protected routes", () => {
  test.skip(!usesFakeApi, "Protected routes need the local fake auth API.");

  test.beforeEach(async ({ context, baseURL, fakeApi }) => {
    await enterAsInvitedMember(context, baseURL, fakeApi);
  });

  for (const theme of ["light", "dark"] as const) {
    for (const { path, roles } of protectedCases) {
      test(`${path} resolves the ${theme} surface hierarchy`, async ({
        page,
      }) => {
        await openWithTheme(page, path, theme);
        await expectSurfaceHierarchy(page, roles, theme);
      });
    }
  }

  test("switching themes does not move the campus controls", async ({
    page,
  }) => {
    await openWithTheme(page, "/campus/c-1", "light");

    const controls = page.locator('[data-layout-anchor="campus-controls"]');
    await expect(controls).toBeVisible();
    const lightBox = await controls.boundingBox();
    expect(lightBox).not.toBeNull();

    // The rail hosts the theme switch; the floating one hides on this page.
    const themeSwitch = page.getByRole("button", {
      name: "Switch to dark mode",
    });
    await expect(themeSwitch).toHaveCount(1);
    await page
      .getByRole("navigation", { name: "Campus" })
      .getByRole("button", { name: "Switch to dark mode" })
      .click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

    const darkBox = await controls.boundingBox();
    expect(darkBox).not.toBeNull();
    expect(darkBox).toEqual(lightBox);
  });
});

test("the landing hero uses the design-system brand colors", async ({
  page,
}) => {
  await openWithTheme(page, "/", "light");

  await expect(page.locator("#hero")).toHaveCSS(
    "background-color",
    "rgb(49, 85, 214)",
  );
  await expect(page.locator("#hero .text-accent").first()).toHaveCSS(
    "color",
    "rgb(255, 210, 62)",
  );
});
