import { expect, type Page } from "@playwright/test";

import { enterCampus } from "./support/campus-entry";
import {
  membership,
  type ScriptedReply,
  sessions,
  signIn,
  test,
} from "./support/fake-api-fixture";
import { installSanityMapStub } from "./support/sanity-stub";

test.skip(
  Boolean(process.env.PLAYWRIGHT_BASE_URL),
  "Needs the local fake auth API started by playwright.config.ts.",
);

const PEOPLE = "/campus/c-3/people";
const STORAGE = "https://storage.e2e.test";
const MEDIA = "https://media.e2e.test";
const NEW_PICTURE = `${MEDIA}/avatars/ada.webp`;

const profile = {
  id: "55555555-5555-4555-8555-555555555555",
  email: "ada@campus.local",
  firstName: "Ada",
  lastName: "Lovelace",
  displayName: "Ada L.",
  bio: null,
  phone: null,
  avatarUrl: null,
  spriteKey: null,
  memberships: [
    {
      role: "student",
      cohort: { id: "c-3", name: "Cohort 3", code: "C3" },
      track: { id: "t-1", name: "Backend", code: "BE" },
    },
  ],
};

const json = (body: unknown, status = 200): ScriptedReply => ({
  status,
  body,
});

test.beforeEach(async ({ baseURL, context, fakeApi, page }) => {
  await installSanityMapStub(page);
  await signIn(context, baseURL);
  await fakeApi.scriptSession(sessions.admin(membership("c-3", "Cohort 3")));
  await fakeApi.scriptRoutes({
    "GET /v1/users": json({
      items: [],
      meta: { page: 1, perPage: 20, total: 0, totalPages: 1 },
    }),
    "GET /v1/cohorts/c-3": json({
      id: "c-3",
      name: "Cohort 3",
      code: "C3",
      tracks: [],
    }),
    "GET /v1/cohorts/c-3/profiles": json([]),
    "GET /v1/users/me": json(profile),
    "GET /v1/uploads/limits": json({
      maxAttachments: 10,
      kinds: [
        {
          kind: "avatar",
          contentTypes: ["image/jpeg", "image/png", "image/webp"],
          maxBytes: 2_097_152,
        },
      ],
    }),
    "POST /v1/uploads": json(
      {
        method: "PUT",
        mediaId: "88888888-8888-4888-8888-888888888888",
        uploadUrl: `${STORAGE}/holding/m-1?signature=abc`,
        headers: { "Content-Type": "image/webp", "x-amz-meta-kind": "avatar" },
        expiresAt: "2099-01-01T00:10:00.000Z",
      },
      201,
    ),
    "PUT /v1/users/me/avatar": json({ ...profile, avatarUrl: NEW_PICTURE }),
    "DELETE /v1/users/me/avatar": json(profile),
  });
});

// A 1200×800 photo-like PNG drawn in the page, so the cropper has a real,
// non-square picture to work on.
async function photo(page: Page): Promise<Buffer> {
  const dataUrl = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 1200;
    canvas.height = 800;
    const context = canvas.getContext("2d")!;
    const gradient = context.createLinearGradient(0, 0, 1200, 800);
    gradient.addColorStop(0, "#3155D6");
    gradient.addColorStop(1, "#FFD23E");
    context.fillStyle = gradient;
    context.fillRect(0, 0, 1200, 800);
    context.fillStyle = "#ffffff";
    context.beginPath();
    context.arc(600, 400, 220, 0, Math.PI * 2);
    context.fill();
    return canvas.toDataURL("image/png");
  });
  return Buffer.from(dataUrl.split(",")[1]!, "base64");
}

async function openProfile(page: Page) {
  await enterCampus(page, PEOPLE);
  await page.getByRole("button", { name: /^Your account/ }).click();
  await page.getByRole("button", { name: "Edit profile" }).click();
  return page.getByRole("dialog", { name: "Profile" });
}

test("crops, uploads and sets a new picture, then removes it", async ({
  page,
  fakeApi,
}, testInfo) => {
  const stored: { headers: Record<string, string>; body: Buffer }[] = [];
  await page.route(`${STORAGE}/**`, async (route) => {
    const request = route.request();
    if (request.method() === "PUT") {
      stored.push({
        headers: request.headers(),
        body: request.postDataBuffer() ?? Buffer.alloc(0),
      });
    }
    await route.fulfill({
      status: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "PUT",
        "Access-Control-Allow-Headers": "content-type, x-amz-meta-kind",
      },
    });
  });
  await page.route(`${MEDIA}/**`, (route) =>
    route.fulfill({
      status: 200,
      contentType: "image/webp",
      body: stored.at(-1)?.body ?? Buffer.alloc(0),
    }),
  );

  const dialog = await openProfile(page);
  await expect(
    dialog.getByRole("button", { name: "Upload picture" }),
  ).toBeVisible();

  await dialog.getByLabel("Choose a picture").setInputFiles({
    name: "photo.png",
    mimeType: "image/png",
    buffer: await photo(page),
  });
  const cropper = page.getByRole("dialog", { name: "Crop your picture" });
  await expect(cropper).toBeVisible();
  await cropper.getByLabel("Zoom").fill("1.6");
  await page.screenshot({ path: testInfo.outputPath("1-cropper.png") });

  await cropper.getByRole("button", { name: "Save picture" }).click();
  await expect(cropper).toBeHidden();
  await expect(page.getByText("Picture updated")).toBeVisible();

  // What reached storage: one WebP of the signed type, with every signed header.
  expect(stored).toHaveLength(1);
  const [upload] = stored;
  expect(upload!.headers["content-type"]).toBe("image/webp");
  expect(upload!.headers["x-amz-meta-kind"]).toBe("avatar");
  expect(upload!.body.subarray(0, 4).toString("ascii")).toBe("RIFF");
  expect(upload!.body.subarray(8, 12).toString("ascii")).toBe("WEBP");

  const signing = await fakeApi.requestsTo("POST", "/v1/uploads");
  expect(signing).toHaveLength(1);
  expect(JSON.parse(signing[0]!.body)).toStrictEqual({
    kind: "avatar",
    contentType: "image/webp",
    sizeBytes: upload!.body.length,
  });
  expect(await fakeApi.requestsTo("PUT", "/v1/users/me/avatar")).toHaveLength(
    1,
  );

  // The new picture is drawn, and decodes as the 512×512 square it was cut to.
  const drawn = dialog.locator('[data-slot="avatar-image"]');
  await expect(drawn).toBeVisible();
  expect(
    await drawn.evaluate((image: HTMLImageElement) => [
      image.naturalWidth,
      image.naturalHeight,
    ]),
  ).toEqual([512, 512]);
  await expect(
    dialog.getByRole("button", { name: "Change picture" }),
  ).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("2-picture-set.png") });

  await dialog.getByRole("button", { name: "Remove picture" }).click();
  const prompt = page.getByRole("dialog", { name: "Remove your picture?" });
  await prompt.getByRole("button", { name: "Remove picture" }).click();
  await expect(page.getByText("Picture removed")).toBeVisible();
  await expect(
    dialog.getByRole("button", { name: "Upload picture" }),
  ).toBeVisible();
  await expect(dialog.locator('[data-slot="avatar-image"]')).toHaveCount(0);
  expect(
    await fakeApi.requestsTo("DELETE", "/v1/users/me/avatar"),
  ).toHaveLength(1);
  await page.screenshot({ path: testInfo.outputPath("3-picture-removed.png") });
});
