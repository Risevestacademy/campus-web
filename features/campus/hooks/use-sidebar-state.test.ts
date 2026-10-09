import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { setActivePanel, setSidebarMode } from "../store/sidebar-store";
import { useSidebarMode } from "./use-sidebar-state";

beforeEach(() => {
  window.localStorage.clear();
  Reflect.deleteProperty(document.documentElement.dataset, "sidebarOpen");
});

describe("sidebar mode", () => {
  it("stays in Campus mode without an administration panel", () => {
    setSidebarMode("admin");

    const { result } = renderHook(() => useSidebarMode("admin", false));

    expect(result.current).toBe("campus");
  });

  it("starts in Campus mode when nothing is stored", () => {
    const { result } = renderHook(() => useSidebarMode(undefined, true));

    expect(result.current).toBe("campus");
  });

  it("restores the stored mode when the route sets none", () => {
    setSidebarMode("admin");

    const { result } = renderHook(() => useSidebarMode(undefined, true));

    expect(result.current).toBe("admin");
  });

  it("enters in the route mode whatever is stored", () => {
    setSidebarMode("campus");

    const { result } = renderHook(() => useSidebarMode("admin", true));

    expect(result.current).toBe("admin");
  });

  it("follows a panel chosen after entering in the route mode", () => {
    const { result } = renderHook(() => useSidebarMode("admin", true));

    act(() => setActivePanel("chat"));

    expect(result.current).toBe("campus");
  });
});
