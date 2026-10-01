import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import SignInPage from "./page";

describe("SignInPage", () => {
  it("starts Google OAuth with the requested campus join destination", async () => {
    render(
      await SignInPage({
        searchParams: Promise.resolve({
          returnTo: "/campus/42/join",
        }),
      }),
    );

    expect(
      screen.getByRole("link", { name: "Continue with Google" }),
    ).toHaveAttribute(
      "href",
      "/api/v1/auth/google?returnTo=%2Fcampus%2F42%2Fjoin",
    );
  });

  it("shows a safe message for a known backend error", async () => {
    render(
      await SignInPage({
        searchParams: Promise.resolve({ error: "denied" }),
      }),
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Google sign-in was cancelled.",
    );
  });

  it("does not expose an unknown backend error value", async () => {
    render(
      await SignInPage({
        searchParams: Promise.resolve({
          error: "private-backend-detail",
        }),
      }),
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Sign-in could not be completed. Please try again.",
    );
    expect(screen.getByRole("alert")).not.toHaveTextContent(
      "private-backend-detail",
    );
  });
});
