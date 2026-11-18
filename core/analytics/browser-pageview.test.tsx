import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useMountEffect } from "@/shared/lib/use-mount-effect";

import { BrowserPageview } from "./browser-pageview";
import { captureBrowserPageview } from "./client";

const navigation = vi.hoisted(() => ({ pathname: "/campus" }));
const calls = vi.hoisted(() => [] as string[]);

vi.mock("next/navigation", () => ({ usePathname: () => navigation.pathname }));
vi.mock("./client", () => ({
  captureBrowserPageview: vi.fn(() => {
    calls.push("pageview");
  }),
}));

function PageEffect() {
  useMountEffect(() => {
    calls.push("page");
  });
  return null;
}

function Layout() {
  return (
    <>
      <PageEffect key={navigation.pathname} />
      <BrowserPageview />
    </>
  );
}

describe("BrowserPageview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    calls.length = 0;
    navigation.pathname = "/campus";
  });

  it("captures one pageview, after the page's own mount effects, and renders nothing", () => {
    const { container } = render(<Layout />);

    expect(calls).toEqual(["page", "pageview"]);
    expect(container).toBeEmptyDOMElement();
  });

  it("captures again only when the pathname changes", () => {
    const view = render(<Layout />);

    view.rerender(<Layout />);
    navigation.pathname = "/campus/3";
    view.rerender(<Layout />);

    expect(vi.mocked(captureBrowserPageview).mock.calls).toEqual([
      ["/campus"],
      ["/campus/3"],
    ]);
    expect(calls).toEqual(["page", "pageview", "page", "pageview"]);
  });
});
