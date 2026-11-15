import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { http, HttpResponse } from "msw";
import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { uploadMedia } from "@/core/uploads";
import { useMountEffect } from "@/shared/lib/use-mount-effect";
import { TEST_ORIGIN } from "@/tests/fixtures/mock-api";
import { withQueryClient } from "@/tests/fixtures/query-client";

import type { OwnProfile } from "../types";
import { AvatarEditor } from "./avatar-editor";

const mockApi = await vi.hoisted(async () => {
  const { startMockApi } = await import("@/tests/fixtures/mock-api");
  return startMockApi();
});
const navigation = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: navigation.refresh }),
}));
vi.mock("@/core/uploads", () => ({ uploadMedia: vi.fn() }));

const CROPPED = new Blob(["cropped"], { type: "image/webp" });
vi.mock("../lib/crop-avatar", () => ({
  cropAvatar: vi.fn(async () => CROPPED),
}));

// jsdom draws no images, so the cropper settles on a crop as soon as it is
// shown.
vi.mock("react-easy-crop", () => ({
  default: function CropperStub({
    onCropComplete,
  }: {
    onCropComplete: (area: unknown, pixels: unknown) => void;
  }) {
    // Once, as the real cropper reports a crop when its image loads.
    useMountEffect(() => {
      const area = { x: 0, y: 0, width: 100, height: 100 };
      onCropComplete(area, area);
    });
    return <div data-testid="cropper" />;
  },
}));

const AVATAR_URL = `${TEST_ORIGIN}/api/v1/users/me/avatar`;
const profile: OwnProfile = {
  id: "u-1",
  email: "ada@campus.local",
  firstName: "Ada",
  lastName: "Lovelace",
  displayName: "Ada L.",
  bio: null,
  phone: null,
  avatarUrl: null,
  memberships: [],
};

beforeEach(() => {
  URL.createObjectURL = vi.fn(() => "blob:picture");
  URL.revokeObjectURL = vi.fn();
});
afterEach(() => {
  mockApi.reset();
  vi.mocked(uploadMedia).mockReset();
  navigation.refresh.mockReset();
});
afterAll(() => mockApi.close());

function renderEditor(current: OwnProfile = profile) {
  render(withQueryClient(<AvatarEditor profile={current} />));
}

function choose(file: File) {
  fireEvent.change(screen.getByLabelText("Choose a picture"), {
    target: { files: [file] },
  });
}

const photo = new File(["photo"], "me.jpg", { type: "image/jpeg" });

describe("AvatarEditor", () => {
  it("crops, uploads and sets a new picture", async () => {
    vi.mocked(uploadMedia).mockResolvedValue({
      kind: "uploaded",
      mediaId: "m-1",
    });
    const bodies: unknown[] = [];
    mockApi.server.use(
      http.put(AVATAR_URL, async ({ request }) => {
        bodies.push(await request.json());
        return HttpResponse.json({
          ...profile,
          avatarUrl: "https://media.example.test/u-1.webp",
        });
      }),
    );
    renderEditor();

    choose(photo);
    const dialog = await screen.findByRole("dialog", {
      name: "Crop your picture",
    });
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Save picture" }),
    );

    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", { name: "Crop your picture" }),
      ).not.toBeInTheDocument(),
    );
    expect(uploadMedia).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ kind: "avatar", file: CROPPED }),
    );
    expect(bodies).toStrictEqual([{ mediaId: "m-1" }]);
    expect(navigation.refresh).toHaveBeenCalledOnce();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:picture");
  });

  it("explains a refused upload in the cropper and keeps it open", async () => {
    vi.mocked(uploadMedia).mockResolvedValue({
      kind: "problem",
      problem: { kind: "too-large", maxBytes: 2_000_000 },
    });
    renderEditor();

    choose(photo);
    const dialog = await screen.findByRole("dialog", {
      name: "Crop your picture",
    });
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Save picture" }),
    );

    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "That picture is over 2 MB. Choose a smaller one.",
    );
  });

  it("cancels an upload in progress", async () => {
    vi.mocked(uploadMedia).mockImplementation(
      ({ onProgress, signal }) =>
        new Promise((resolve) => {
          onProgress?.(0.4);
          signal?.addEventListener("abort", () =>
            resolve({ kind: "problem", problem: { kind: "cancelled" } }),
          );
        }),
    );
    renderEditor();

    choose(photo);
    const dialog = await screen.findByRole("dialog", {
      name: "Crop your picture",
    });
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Save picture" }),
    );

    expect(
      await within(dialog).findByRole("progressbar", {
        name: "Uploading your picture",
      }),
    ).toHaveAttribute("aria-valuenow", "40");
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Cancel upload" }),
    );

    expect(
      await within(dialog).findByRole("button", { name: "Save picture" }),
    ).toBeEnabled();
    expect(within(dialog).queryByRole("alert")).not.toBeInTheDocument();
  });

  it("asks before removing the picture, then removes it", async () => {
    const removed = vi.fn();
    mockApi.server.use(
      http.delete(AVATAR_URL, () => {
        removed();
        return HttpResponse.json(profile);
      }),
    );
    renderEditor({
      ...profile,
      avatarUrl: "https://media.example.test/u-1.webp",
    });

    fireEvent.click(screen.getByRole("button", { name: "Remove picture" }));
    const prompt = await screen.findByRole("dialog", {
      name: "Remove your picture?",
    });
    expect(removed).not.toHaveBeenCalled();
    fireEvent.click(
      within(prompt).getByRole("button", { name: "Remove picture" }),
    );

    await waitFor(() => expect(removed).toHaveBeenCalledOnce());
    await waitFor(() => expect(navigation.refresh).toHaveBeenCalledOnce());
  });

  it("offers no removal without a picture", () => {
    renderEditor();

    expect(
      screen.getByRole("button", { name: "Upload picture" }),
    ).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "Remove picture" }),
    ).not.toBeInTheDocument();
  });

  it("turns away a file that is not a picture", () => {
    renderEditor();

    choose(new File(["notes"], "notes.pdf", { type: "application/pdf" }));

    expect(screen.getByRole("alert")).toHaveTextContent(
      "This file couldn't be opened as a picture.",
    );
    expect(
      screen.queryByRole("dialog", { name: "Crop your picture" }),
    ).not.toBeInTheDocument();
  });
});
