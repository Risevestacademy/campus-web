import { expect, type Locator, type Page, test } from "@playwright/test";

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
    path: "/campus/1",
    roles: ["background", "surface", "surface-elevated"],
  },
  { path: "/invite", roles: ["background", "surface"] },
];

async function openWithTheme(page: Page, path: string, theme: Theme) {
  await page.addInitScript(
    ({ storageKey, initialTheme }) => {
      window.localStorage.setItem(storageKey, initialTheme);
    },
    { storageKey: THEME_STORAGE_KEY, initialTheme: theme },
  );

  await page.goto(path);
  await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
}

function surface(page: Page, role: SurfaceRole): Locator {
  return page.locator(`[data-surface-role="${role}"]`).first();
}

for (const theme of ["light", "dark"] as const) {
  for (const routeCase of routeCases) {
    test(`${routeCase.path} resolves the ${theme} surface hierarchy`, async ({
      page,
    }) => {
      await openWithTheme(page, routeCase.path, theme);

      for (const role of routeCase.roles) {
        const element = surface(page, role);
        await expect(element).toBeVisible();
        await expect(element).toHaveCSS(
          "background-color",
          expectedColors[theme][role],
        );
      }
    });
  }
}

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

test("switching themes does not move the campus controls", async ({ page }) => {
  await openWithTheme(page, "/campus/1", "light");

  const controls = page.locator('[data-layout-anchor="campus-controls"]');
  await expect(controls).toBeVisible();
  const lightBox = await controls.boundingBox();
  expect(lightBox).not.toBeNull();

  await page.getByRole("button", { name: "Switch to dark mode" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

  const darkBox = await controls.boundingBox();
  expect(darkBox).not.toBeNull();
  expect(darkBox).toEqual(lightBox);
});
