import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { FeedbackPopup } from "./feedback-popup";

function renderPopup(
  props: Partial<React.ComponentProps<typeof FeedbackPopup>> = {},
) {
  const onClose = vi.fn();

  render(
    <FeedbackPopup
      isOpen
      onClose={onClose}
      userName="Joseph Okoro"
      {...props}
    />,
  );

  return { onClose };
}

async function fillAndSend(kind: string, title: string) {
  fireEvent.click(screen.getByRole("button", { name: kind }));
  fireEvent.change(screen.getByLabelText("Title"), {
    target: { value: title },
  });
  fireEvent.click(screen.getByRole("button", { name: "Send feedback" }));
}

describe("FeedbackPopup", () => {
  it("renders nothing while closed", () => {
    renderPopup({ isOpen: false });

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("shows the form beside the member's feedback list", () => {
    renderPopup();

    const dialog = screen.getByRole("dialog", { name: "Feedback" });
    const list = within(dialog).getByRole("region", {
      name: "Feedback history",
    });

    expect(within(list).getAllByRole("listitem")).toHaveLength(3);
    expect(within(dialog).getByLabelText(/Who\/where in Campus/)).toHaveValue(
      "",
    );
    expect(within(dialog).getAllByText("Optional")).toHaveLength(2);
    expect(
      within(dialog).getByRole("button", { name: "Report" }),
    ).toBeVisible();
    expect(
      within(dialog).queryByText(/received|planned|fixed/i),
    ).not.toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Idea" })).toBeVisible();
  });

  it("asks for a kind and a title before sending", () => {
    renderPopup();

    fireEvent.click(screen.getByRole("button", { name: "Send feedback" }));

    expect(
      screen.getByText("Choose what kind of feedback this is."),
    ).toBeVisible();
    expect(screen.getByText("Give your feedback a short title.")).toBeVisible();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("confirms by first name and adds the feedback to the list", async () => {
    renderPopup();

    await fillAndSend("Idea", "Show who's in a pod before knocking");

    expect(
      await screen.findByRole("heading", { name: "Thanks, Joseph. We got it" }),
    ).toBeVisible();
    expect(
      screen.getByText(/Your idea “Show who's in a pod before knocking”/),
    ).toBeVisible();

    const list = screen.getByRole("region", { name: "Feedback history" });
    const items = within(list).getAllByRole("listitem");

    expect(items).toHaveLength(4);
    expect(items[0]).toHaveTextContent("Show who's in a pod before knocking");
    expect(items[0]).toHaveTextContent("just now");
    expect(within(items[0]!).getByRole("button")).toHaveAttribute(
      "aria-current",
      "true",
    );
  });

  it("shows a history item's details in place of the form and highlights it", () => {
    renderPopup();

    fireEvent.click(
      screen.getByRole("button", { name: /Dark mode for the map/ }),
    );

    expect(
      screen.getByRole("heading", { name: "Dark mode for the map" }),
    ).toBeVisible();
    expect(screen.getByText(/the map stays bright/)).toBeVisible();
    expect(screen.getByText("Map view")).toBeVisible();
    expect(screen.queryByLabelText("Title")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Dark mode for the map/ }),
    ).toHaveAttribute("aria-current", "true");

    fireEvent.click(screen.getByRole("button", { name: "New feedback" }));

    expect(screen.getByLabelText("Title")).toHaveValue("");
  });

  it("returns to an empty form from Send another and New feedback", async () => {
    renderPopup();

    await fillAndSend("Bug", "Mic cuts out");
    fireEvent.click(
      await screen.findByRole("button", { name: "Send another" }),
    );

    expect(screen.getByLabelText("Title")).toHaveValue("");

    await fillAndSend("Bug", "Camera freezes");
    fireEvent.click(
      await screen.findByRole("button", { name: "New feedback" }),
    );

    expect(screen.getByLabelText("Title")).toHaveValue("");
  });

  it("closes from Cancel, the close button and Back to campus", async () => {
    const { onClose } = renderPopup();

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    fireEvent.click(screen.getByRole("button", { name: "Close feedback" }));
    await fillAndSend("Idea", "Dark mode");
    fireEvent.click(
      await screen.findByRole("button", { name: "Back to campus" }),
    );

    expect(onClose).toHaveBeenCalledTimes(3);
  });

  it("rejects a screenshot that is not an image", () => {
    renderPopup();

    fireEvent.change(screen.getByLabelText("Screenshot file"), {
      target: {
        files: [new File(["x"], "notes.txt", { type: "text/plain" })],
      },
    });

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Use a PNG, JPEG, WebP or GIF image.",
    );
  });

  it("pastes the first supported image when the clipboard lists a TIFF first", async () => {
    renderPopup();

    fireEvent.paste(screen.getByLabelText("Title"), {
      clipboardData: {
        files: [
          new File(["x"], "pod.tiff", { type: "image/tiff" }),
          new File(["x"], "pod.png", { type: "image/png" }),
        ],
      },
    });

    expect(await screen.findByAltText("Screenshot preview")).toBeVisible();
    expect(screen.getByText("pod.png")).toBeVisible();
  });

  it("previews the first supported image when files are dropped", async () => {
    renderPopup();

    fireEvent.drop(screen.getByRole("button", { name: /Add a screenshot/ }), {
      dataTransfer: {
        files: [
          new File(["x"], "pod.tiff", { type: "image/tiff" }),
          new File(["x"], "pod.png", { type: "image/png" }),
        ],
      },
    });

    expect(await screen.findByAltText("Screenshot preview")).toBeVisible();
    expect(screen.getByText("pod.png")).toBeVisible();
  });

  it("explains which images work when a non-image file is dropped", () => {
    renderPopup();

    fireEvent.drop(screen.getByRole("button", { name: /Add a screenshot/ }), {
      dataTransfer: {
        files: [new File(["x"], "notes.txt", { type: "text/plain" })],
      },
    });

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Use a PNG, JPEG, WebP or GIF image.",
    );
  });

  it("explains which images work when only an unsupported one is pasted", () => {
    renderPopup();

    fireEvent.paste(screen.getByLabelText("Title"), {
      clipboardData: {
        files: [new File(["x"], "pod.heic", { type: "image/heic" })],
      },
    });

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Use a PNG, JPEG, WebP or GIF image.",
    );
  });

  it("previews a chosen screenshot and lets it be removed", async () => {
    renderPopup();

    fireEvent.change(screen.getByLabelText("Screenshot file"), {
      target: {
        files: [new File(["x"], "pod.png", { type: "image/png" })],
      },
    });

    expect(await screen.findByAltText("Screenshot preview")).toBeVisible();
    expect(screen.getByText("pod.png")).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Remove screenshot" }));

    expect(screen.getByText("Add a screenshot")).toBeVisible();
  });
});
