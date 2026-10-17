import { describe, expect, it, vi } from "vitest";

import {
  createFakeLockManager,
  createFakeNoticeBus,
  settle,
} from "../../testing/fake-presence-locks";
import {
  createPresenceTab,
  type PresenceLocks,
  type PresenceTabPorts,
} from "./presence-tab";

function createBrowser() {
  const lockManager = createFakeLockManager();
  const openNotices = createFakeNoticeBus();
  let nextClient = 0;

  function openTab(
    cohortId: string,
    overrides: Partial<PresenceTabPorts> = {},
  ) {
    const clientId = `tab-${(nextClient += 1)}`;
    const wakeListeners = new Set<() => void>();
    const report = vi.fn<PresenceTabPorts["report"]>();
    const tab = createPresenceTab(cohortId, {
      locks: lockManager.forClient(clientId),
      openNotices,
      report,
      subscribeToWake(listener) {
        wakeListeners.add(listener);
        return () => wakeListeners.delete(listener);
      },
      ...overrides,
    });
    const close = tab.open();

    return {
      clientId,
      close,
      report,
      tab,
      wake: () => wakeListeners.forEach((listener) => listener()),
    };
  }

  return { lockManager, openTab };
}

describe("Presence Tab", () => {
  it("checks before a vacant cohort can be joined", async () => {
    const { openTab } = createBrowser();
    const first = openTab("c-3");

    expect(first.tab.getStatus()).toBe("checking");
    await settle();

    expect(first.tab.getStatus()).toBe("vacant");
  });

  it("holds the cohort for the first tab that joins", async () => {
    const { lockManager, openTab } = createBrowser();
    const first = openTab("c-3");
    await settle();

    await expect(first.tab.claim()).resolves.toBe(true);

    expect(first.tab.getStatus()).toBe("held");
    expect(lockManager.holderOf("campus-presence:c-3")).toBe(first.clientId);
  });

  it("shows a tab opened later that another tab holds the cohort", async () => {
    const { openTab } = createBrowser();
    const first = openTab("c-3");
    await first.tab.claim();

    const second = openTab("c-3");
    await settle();

    expect(second.tab.getStatus()).toBe("elsewhere");
    expect(second.report).toHaveBeenCalledExactlyOnceWith(
      "conflict_shown",
      "pre_join",
    );
  });

  it("refuses a second Join for the same cohort", async () => {
    const { lockManager, openTab } = createBrowser();
    const first = openTab("c-3");
    const second = openTab("c-3");
    await settle();
    await first.tab.claim();

    await expect(second.tab.claim()).resolves.toBe(false);

    expect(second.tab.getStatus()).toBe("elsewhere");
    expect(lockManager.holderOf("campus-presence:c-3")).toBe(first.clientId);
  });

  it("moves a waiting tab to elsewhere when another tab joins", async () => {
    const { openTab } = createBrowser();
    const first = openTab("c-3");
    const second = openTab("c-3");
    await settle();

    await first.tab.claim();
    await settle();

    expect(second.tab.getStatus()).toBe("elsewhere");
  });

  it("keeps cohorts independent", async () => {
    const { openTab } = createBrowser();
    const first = openTab("c-3");
    await first.tab.claim();

    const second = openTab("c-4");
    await settle();

    expect(second.tab.getStatus()).toBe("vacant");
    await expect(second.tab.claim()).resolves.toBe(true);
    expect(first.tab.getStatus()).toBe("held");
  });

  it("moves the session to the tab that takes it over", async () => {
    const { lockManager, openTab } = createBrowser();
    const first = openTab("c-3");
    await first.tab.claim();
    const second = openTab("c-3");
    await settle();

    await second.tab.takeOver();
    await settle();

    expect(second.tab.getStatus()).toBe("held");
    expect(first.tab.getStatus()).toBe("taken-over");
    expect(lockManager.holderOf("campus-presence:c-3")).toBe(second.clientId);
    expect(second.report).toHaveBeenLastCalledWith("moved", "pre_join");
    expect(first.report).toHaveBeenCalledExactlyOnceWith(
      "conflict_shown",
      "taken_over",
    );
  });

  it("moves the session back to a taken-over tab", async () => {
    const { lockManager, openTab } = createBrowser();
    const first = openTab("c-3");
    await first.tab.claim();
    const second = openTab("c-3");
    await settle();
    await second.tab.takeOver();
    await settle();

    await first.tab.takeOver();
    await settle();

    expect(first.tab.getStatus()).toBe("held");
    expect(second.tab.getStatus()).toBe("taken-over");
    expect(lockManager.holderOf("campus-presence:c-3")).toBe(first.clientId);
    expect(first.report).toHaveBeenLastCalledWith("moved", "taken_over");
  });

  it("stays taken over when the new holder leaves", async () => {
    const { openTab } = createBrowser();
    const first = openTab("c-3");
    await first.tab.claim();
    const second = openTab("c-3");
    await settle();
    await second.tab.takeOver();
    await settle();

    second.close();
    first.wake();
    await settle();

    expect(first.tab.getStatus()).toBe("taken-over");
  });

  it("frees the cohort for other tabs when the holder leaves", async () => {
    const { lockManager, openTab } = createBrowser();
    const first = openTab("c-3");
    await first.tab.claim();
    const second = openTab("c-3");
    await settle();

    first.close();
    await settle();

    expect(lockManager.holderOf("campus-presence:c-3")).toBeUndefined();
    expect(second.tab.getStatus()).toBe("vacant");
  });

  it("notices a crashed holder when the page wakes", async () => {
    const { lockManager, openTab } = createBrowser();
    const first = openTab("c-3");
    await first.tab.claim();
    const second = openTab("c-3");
    await settle();

    lockManager.crash(first.clientId);
    second.wake();
    await settle();

    expect(second.tab.getStatus()).toBe("vacant");
  });

  it("ignores a probe answered after a newer one", async () => {
    const { lockManager, openTab } = createBrowser();
    const first = openTab("c-3");
    await settle();
    let answerStaleProbe: (snapshot: LockManagerSnapshot) => void = () => {};
    const locks = lockManager.forClient("tab-slow");
    const query = vi
      .fn<PresenceLocks["query"]>()
      .mockReturnValueOnce(
        new Promise((resolve) => {
          answerStaleProbe = resolve;
        }),
      )
      .mockImplementation(locks.query);
    const second = openTab("c-3", { locks: { ...locks, query } });

    await first.tab.claim();
    await settle();
    answerStaleProbe({ held: [], pending: [] });
    await settle();

    expect(second.tab.getStatus()).toBe("elsewhere");
  });

  it("gives back a lock granted after the tab closed", async () => {
    const { lockManager, openTab } = createBrowser();
    const locks = lockManager.forClient("tab-slow");
    const first = openTab("c-3", {
      locks: {
        query: locks.query,
        async request(name, options, callback) {
          await settle();
          return locks.request(name, options, callback);
        },
      },
    });
    await settle();

    const claim = first.tab.claim();
    first.close();

    await expect(claim).resolves.toBe(false);
    await settle();
    expect(lockManager.holderOf("campus-presence:c-3")).toBeUndefined();
    expect(first.report).not.toHaveBeenCalled();
  });

  it("lets every tab join without Web Locks", async () => {
    const { openTab } = createBrowser();
    const first = openTab("c-3", { locks: null });
    const second = openTab("c-3", { locks: null });

    expect(second.tab.getStatus()).toBe("vacant");
    await expect(first.tab.claim()).resolves.toBe(true);
    await expect(second.tab.claim()).resolves.toBe(true);
    expect(second.tab.getStatus()).toBe("held");
  });

  it("joins without coordination when the lock request fails", async () => {
    const { lockManager, openTab } = createBrowser();
    const locks = lockManager.forClient("tab-blocked");
    const first = openTab("c-3", {
      locks: {
        query: locks.query,
        request: () =>
          Promise.reject(new DOMException("Blocked", "SecurityError")),
      },
    });
    await settle();

    await expect(first.tab.claim()).resolves.toBe(true);

    expect(first.tab.getStatus()).toBe("held");
  });

  it("notifies subscribers of every status change", async () => {
    const { openTab } = createBrowser();
    const first = openTab("c-3");
    const listener = vi.fn();
    first.tab.subscribe(listener);

    await settle();
    await first.tab.claim();

    expect(listener).toHaveBeenCalledTimes(2);
  });
});
