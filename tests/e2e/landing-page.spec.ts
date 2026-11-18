import { expect, type Locator, type Page, test } from "@playwright/test";

import { blockPostHog, rejectAnalyticsUpFront } from "./support/analytics";

type Theme = "light" | "dark";

const THEMES: readonly Theme[] = ["light", "dark"];
const PHONE_WIDTHS = [320, 375, 390] as const;
const THEME_STORAGE_KEY = "campus-theme";

const NORMAL_TEXT_CONTRAST = 4.5;
const LARGE_TEXT_CONTRAST = 3;

async function openLandingPage(page: Page, theme: Theme) {
  // Builds carry the real analytics token, so the consent choice would open
  // over the page and be sampled as part of the backdrop.
  await blockPostHog(page.context());
  await rejectAnalyticsUpFront(page.context());
  await page.addInitScript(
    ({ storageKey, initialTheme }) => {
      window.localStorage.setItem(storageKey, initialTheme);
    },
    { storageKey: THEME_STORAGE_KEY, initialTheme: theme },
  );
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
}

// Backgrounds here are gradients, so the colour behind the text is read from
// pixels: every run of text is made transparent, each line of it is captured,
// and it must pass in its own colour against both the lightest and the darkest
// pixel behind that line. Lines are sampled one by one because a block's box
// can reach past its text to neighbours such as the sticker beside the hero
// heading, and runs one by one because a heading can hold a differently
// coloured span. Rotation is switched off while sampling: a tilted card's text
// has an upright box that reaches onto the hero behind the card.
async function contrastAgainstBackdrop(page: Page, text: Locator) {
  const upright = await page.addStyleTag({
    content: "* { transform: none !important; rotate: none !important; }",
  });
  await text.scrollIntoViewIfNeeded();
  const lines = await text.evaluate((element) => {
    const found: {
      color: string;
      clip: { x: number; y: number; width: number; height: number };
    }[] = [];
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const owner = node.parentElement;
      if (!owner || !node.textContent?.trim()) continue;
      const range = document.createRange();
      range.selectNodeContents(node);
      for (const { x, y, width, height } of range.getClientRects()) {
        if (width > 0 && height > 0) {
          found.push({
            color: getComputedStyle(owner).color,
            clip: { x, y, width, height },
          });
        }
      }
    }
    for (const owner of [element, ...element.querySelectorAll("*")]) {
      (owner as HTMLElement).style.color = "transparent";
    }
    return found;
  });
  expect(lines.length).toBeGreaterThan(0);

  const captures: string[] = [];
  for (const { clip } of lines) {
    captures.push((await page.screenshot({ clip })).toString("base64"));
  }
  await text.evaluate((element) => {
    for (const owner of [element, ...element.querySelectorAll("*")]) {
      (owner as HTMLElement).style.color = "";
    }
  });

  await upright.evaluate((style) => (style as Element).remove());

  const ratios: number[] = [];
  for (const [index, { color }] of lines.entries()) {
    ratios.push(await contrastOfCapture(page, captures[index] ?? "", color));
  }
  return Math.min(...ratios);
}

async function contrastOfCapture(page: Page, png: string, color: string) {
  return page.evaluate(
    async ({ png, textColor }) => {
      function luminance(red: number, green: number, blue: number) {
        const [r = 0, g = 0, b = 0] = [red, green, blue].map((channel) => {
          const value = channel / 255;
          return value <= 0.03928
            ? value / 12.92
            : ((value + 0.055) / 1.055) ** 2.4;
        });
        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
      }

      const bitmap = await createImageBitmap(
        await (await fetch(`data:image/png;base64,${png}`)).blob(),
      );
      const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
      const context = canvas.getContext("2d");
      if (!context) throw new Error("No canvas context.");
      context.drawImage(bitmap, 0, 0);
      const { data } = context.getImageData(0, 0, bitmap.width, bitmap.height);

      let lightest = 0;
      let darkest = 1;
      for (let index = 0; index < data.length; index += 4) {
        const value = luminance(
          data[index] ?? 0,
          data[index + 1] ?? 0,
          data[index + 2] ?? 0,
        );
        lightest = Math.max(lightest, value);
        darkest = Math.min(darkest, value);
      }

      // Tokens compute to colour spaces other than rgb(), so let the
      // canvas turn the computed colour into sRGB channels.
      const swatch = new OffscreenCanvas(1, 1).getContext("2d");
      if (!swatch) throw new Error("No canvas context.");
      swatch.fillStyle = textColor;
      swatch.fillRect(0, 0, 1, 1);
      const [red = 0, green = 0, blue = 0] = swatch.getImageData(
        0,
        0,
        1,
        1,
      ).data;
      const own = luminance(red, green, blue);
      const ratio = (a: number, b: number) =>
        (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
      return Math.min(ratio(own, lightest), ratio(own, darkest));
    },
    { png, textColor: color },
  );
}

for (const theme of THEMES) {
  test.describe(`${theme} theme`, () => {
    test.use({ colorScheme: theme });

    test("hero text meets contrast", async ({ page }) => {
      await openLandingPage(page, theme);
      const hero = page.locator("#hero");

      const heading = hero.getByRole("heading", { level: 1 });
      expect(
        await contrastAgainstBackdrop(page, heading),
      ).toBeGreaterThanOrEqual(LARGE_TEXT_CONTRAST);

      for (const text of [
        hero.getByText("Your Rise community"),
        hero.getByText("Access is by invitation only."),
        hero.getByText("Available to chat"),
        hero.getByText("Meet in a private room"),
      ]) {
        expect(
          await contrastAgainstBackdrop(page, text),
        ).toBeGreaterThanOrEqual(NORMAL_TEXT_CONTRAST);
      }
    });

    test("call to action text meets contrast", async ({ page }) => {
      await openLandingPage(page, theme);
      const cta = page.locator("#cta");

      for (const text of [cta.getByText(/^Your classes, your conversations/)]) {
        expect(
          await contrastAgainstBackdrop(page, text),
        ).toBeGreaterThanOrEqual(NORMAL_TEXT_CONTRAST);
      }
    });

    for (const width of PHONE_WIDTHS) {
      test(`shows the logo and menu without sideways scrolling at ${width}px`, async ({
        page,
      }) => {
        await page.setViewportSize({ width, height: 800 });
        await openLandingPage(page, theme);

        await expect(
          page.getByRole("link", { name: "Campus by Rise" }).first(),
        ).toBeInViewport();
        await expect(
          page.getByRole("button", { name: "Open menu" }),
        ).toBeInViewport();

        const overflow = await page.evaluate(
          () =>
            document.documentElement.scrollWidth -
            document.documentElement.clientWidth,
        );
        expect(overflow).toBeLessThanOrEqual(0);
      });
    }
  });
}
