import { afterEach, describe, expect, it, vi } from "vitest";

import { fakeKaplay, fakePreparedMap } from "../testing/fake-kaplay";
import { fakeImage } from "../testing/sanity-map-fixture";
import { createCampusRuntime } from "./campus-runtime";

function container() {
  const element = document.createElement("div");
  document.body.append(element);
  return element;
}

function mountOptions(
  overrides: { onRenderError?: () => void; signal?: AbortSignal } = {},
) {
  return {
    onRenderError: vi.fn(),
    signal: new AbortController().signal,
    ...overrides,
  };
}

afterEach(() => {
  document.body.replaceChildren();
  document.documentElement.style.removeProperty("--color-cobalt-100");
});

describe("createCampusRuntime", () => {
  it("creates KAPLAY once across start, stop and a later start", async () => {
    const kaplay = fakeKaplay();
    const runtime = createCampusRuntime();
    const prepared = fakePreparedMap(kaplay.module);
    const first = container();
    const second = container();

    const firstGame = await runtime.start(first, prepared, mountOptions());
    const canvas = first.querySelector("canvas");
    firstGame.stop();
    await runtime.start(second, prepared, mountOptions());

    expect(kaplay.kaplay).toHaveBeenCalledOnce();
    expect(canvas).not.toBeNull();
    expect(first.querySelector("canvas")).toBeNull();
    expect(second.querySelector("canvas")).toBe(canvas);
  });

  it("puts its canvas in the first container before KAPLAY reads its size", async () => {
    const kaplay = fakeKaplay();
    const element = container();
    kaplay.kaplay.mockImplementationOnce((options) => {
      expect(options.canvas?.parentElement).toBe(element);
      return fakeKaplay().kaplay(options);
    });

    await createCampusRuntime().start(
      element,
      fakePreparedMap(kaplay.module),
      mountOptions(),
    );

    expect(kaplay.kaplay).toHaveBeenCalledOnce();
  });

  it("replaces the previous mount's map instead of stacking another", async () => {
    const kaplay = fakeKaplay();
    const runtime = createCampusRuntime();
    const prepared = fakePreparedMap(kaplay.module);

    await runtime.start(container(), prepared, mountOptions());
    await runtime.start(container(), prepared, mountOptions());

    expect(kaplay.contexts[0]!.liveObjects()).toBe(2);
  });

  it("clears the map when its game stops", async () => {
    const kaplay = fakeKaplay();
    const game = await createCampusRuntime().start(
      container(),
      fakePreparedMap(kaplay.module),
      mountOptions(),
    );

    game.stop();

    expect(kaplay.contexts[0]!.liveObjects()).toBe(0);
  });

  it("paints the background from the theme token", async () => {
    document.documentElement.style.setProperty("--color-cobalt-100", "#123abc");
    const kaplay = fakeKaplay();

    await createCampusRuntime().start(
      container(),
      fakePreparedMap(kaplay.module),
      mountOptions(),
    );

    expect(kaplay.kaplay).toHaveBeenCalledWith(
      expect.objectContaining({ background: "#123abc" }),
    );
  });

  it("takes every decoded image before awaiting the first sprite upload", async () => {
    const kaplay = fakeKaplay({ autoUpload: false });
    const images = [fakeImage(), fakeImage()];
    const prepared = fakePreparedMap(kaplay.module, { images });

    const game = createCampusRuntime().start(
      container(),
      prepared,
      mountOptions(),
    );

    expect(prepared.tilesets.map(({ decodedImage }) => decodedImage)).toEqual([
      undefined,
      undefined,
    ]);
    expect(kaplay.uploads.map(({ source }) => source)).toEqual(images);
    kaplay.uploads.forEach((upload) => upload.finish());
    await game;
    images.forEach((image) => expect(image.close).toHaveBeenCalledOnce());
  });

  it("uploads a map version once and closes images decoded again later", async () => {
    const kaplay = fakeKaplay();
    const runtime = createCampusRuntime();
    const repeatImages = [fakeImage(), fakeImage()];

    await runtime.start(
      container(),
      fakePreparedMap(kaplay.module),
      mountOptions(),
    );
    await runtime.start(
      container(),
      fakePreparedMap(kaplay.module, { images: repeatImages }),
      mountOptions(),
    );

    expect(kaplay.uploads).toHaveLength(2);
    repeatImages.forEach((image) => expect(image.close).toHaveBeenCalledOnce());
  });

  it("uploads a newly published version under its own sprite names", async () => {
    const kaplay = fakeKaplay();
    const runtime = createCampusRuntime();

    await runtime.start(
      container(),
      fakePreparedMap(kaplay.module),
      mountOptions(),
    );
    await runtime.start(
      container(),
      fakePreparedMap(kaplay.module, { version: "version-2" }),
      mountOptions(),
    );

    expect(new Set(kaplay.uploads.map(({ name }) => name)).size).toBe(4);
  });

  it("holds a map only once its sprites have uploaded", async () => {
    const kaplay = fakeKaplay({ autoUpload: false });
    const runtime = createCampusRuntime();
    const identity = { mapId: "campus", version: "version-1" };

    const game = runtime.start(
      container(),
      fakePreparedMap(kaplay.module),
      mountOptions(),
    );
    expect(runtime.holdsMap(identity)).toBe(false);

    kaplay.uploads.forEach((upload) => upload.finish());
    await game;

    expect(runtime.holdsMap(identity)).toBe(true);
    expect(runtime.holdsMap({ ...identity, version: "version-2" })).toBe(false);
  });

  it("adds nothing for a start stopped during its sprite upload", async () => {
    const kaplay = fakeKaplay({ autoUpload: false });
    const runtime = createCampusRuntime();
    const prepared = fakePreparedMap(kaplay.module);

    const superseded = runtime.start(container(), prepared, mountOptions());
    const current = runtime.start(container(), prepared, mountOptions());
    kaplay.uploads.forEach((upload) => upload.finish());

    await expect(superseded).rejects.toMatchObject({ name: "AbortError" });
    await current;
    expect(kaplay.uploads).toHaveLength(2);
    expect(kaplay.contexts[0]!.liveObjects()).toBe(2);
  });

  it("uploads again from tileset URLs after an upload failed", async () => {
    const kaplay = fakeKaplay({ autoUpload: false });
    const runtime = createCampusRuntime();
    const image = fakeImage();
    const prepared = fakePreparedMap(kaplay.module, { images: [image] });

    const failed = runtime.start(container(), prepared, mountOptions());
    kaplay.uploads[0]!.fail();
    await expect(failed).rejects.toThrow("The sprite upload failed.");

    const retried = runtime.start(container(), prepared, mountOptions());
    kaplay.uploads[1]!.finish();
    await retried;

    expect(kaplay.uploads.map(({ source }) => source)).toEqual([
      image,
      "https://cdn.example/tileset-0.png",
    ]);
    expect(image.close).toHaveBeenCalled();
  });

  it("rejects a start whose first frame fails", async () => {
    const kaplay = fakeKaplay({ autoDraw: false });
    const onRenderError = vi.fn();

    const game = createCampusRuntime().start(
      container(),
      fakePreparedMap(kaplay.module),
      mountOptions({ onRenderError }),
    );
    await vi.waitFor(() => expect(kaplay.contexts[0]!.liveObjects()).toBe(2));
    kaplay.contexts[0]!.failFrame(new Error("Draw failed."));

    await expect(game).rejects.toThrow("Draw failed.");
    expect(onRenderError).not.toHaveBeenCalled();
  });

  it("reports a render error after the first frame once", async () => {
    const kaplay = fakeKaplay();
    const onRenderError = vi.fn();

    await createCampusRuntime().start(
      container(),
      fakePreparedMap(kaplay.module),
      mountOptions({ onRenderError }),
    );
    kaplay.contexts[0]!.failFrame();
    kaplay.contexts[0]!.failFrame();

    expect(onRenderError).toHaveBeenCalledOnce();
  });

  it("restarts on a fresh context after a render error", async () => {
    const kaplay = fakeKaplay();
    const runtime = createCampusRuntime();
    const identity = { mapId: "campus", version: "version-1" };

    const failedGame = await runtime.start(
      container(),
      fakePreparedMap(kaplay.module),
      mountOptions(),
    );
    kaplay.contexts[0]!.failFrame();
    failedGame.stop();
    expect(runtime.holdsMap(identity)).toBe(false);

    const element = container();
    await runtime.start(
      element,
      fakePreparedMap(kaplay.module),
      mountOptions(),
    );

    expect(kaplay.kaplay).toHaveBeenCalledTimes(2);
    expect(kaplay.contexts[0]!.stopLoop).toHaveBeenCalledOnce();
    expect(kaplay.uploads).toHaveLength(4);
    expect(element.querySelectorAll("canvas")).toHaveLength(1);
    expect(runtime.holdsMap(identity)).toBe(true);
  });

  it("clears a start whose signal aborts before its first frame", async () => {
    const kaplay = fakeKaplay({ autoUpload: false });
    const controller = new AbortController();
    const element = container();

    const game = createCampusRuntime().start(
      element,
      fakePreparedMap(kaplay.module),
      mountOptions({ signal: controller.signal }),
    );
    controller.abort();
    expect(element.querySelector("canvas")).toBeNull();
    kaplay.uploads.forEach((upload) => upload.finish());

    await expect(game).rejects.toMatchObject({ name: "AbortError" });
    expect(kaplay.contexts[0]!.liveObjects()).toBe(0);
  });

  it("adds nothing for a start aborted while its sprites are already held", async () => {
    const kaplay = fakeKaplay();
    const runtime = createCampusRuntime();
    const prepared = fakePreparedMap(kaplay.module);
    (await runtime.start(container(), prepared, mountOptions())).stop();
    const controller = new AbortController();

    const aborted = runtime.start(
      container(),
      prepared,
      mountOptions({ signal: controller.signal }),
    );
    controller.abort();
    const current = runtime.start(container(), prepared, mountOptions());

    await expect(aborted).rejects.toMatchObject({ name: "AbortError" });
    await current;
    expect(kaplay.contexts[0]!.liveObjects()).toBe(2);
  });
});
