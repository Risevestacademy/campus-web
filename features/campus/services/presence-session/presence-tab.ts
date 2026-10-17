import type { PresenceTabSurface } from "@/core/analytics";

export type PresenceTabStatus =
  "checking" | "vacant" | "elsewhere" | "held" | "taken-over";

export interface PresenceLocks {
  query(): Promise<LockManagerSnapshot>;
  request<T>(
    name: string,
    options: LockOptions,
    callback: LockGrantedCallback<T>,
  ): Promise<T>;
}

export interface NoticeChannel {
  close(): void;
  notify(): void;
}

export interface PresenceTabPorts {
  locks: PresenceLocks | null;
  openNotices: (name: string, onNotice: () => void) => NoticeChannel;
  report: (
    event: "conflict_shown" | "moved",
    surface: PresenceTabSurface,
  ) => void;
  subscribeToWake: (listener: () => void) => () => void;
}

export interface PresenceTab {
  claim(): Promise<boolean>;
  getStatus(): PresenceTabStatus;
  open(): () => void;
  subscribe(listener: () => void): () => void;
  takeOver(): Promise<void>;
}

interface Hold {
  release: () => void;
  settled: Promise<unknown>;
}

const RELEASE_VISIBILITY_QUERIES = 3;

async function waitUntilReleased(locks: PresenceLocks, name: string) {
  for (let query = 0; query < RELEASE_VISIBILITY_QUERIES; query += 1) {
    const snapshot = await locks.query().catch(() => undefined);
    if (!snapshot) return;
    if (!snapshot.held?.some((lock) => lock.name === name)) return;
  }
}

export function presenceLockName(cohortId: string): string {
  return `campus-presence:${cohortId}`;
}

// One browser tab's claim on a cohort's Presence Session. The Web Lock is the
// only ownership record; notices and wake events just trigger a re-probe. It
// coordinates presence and never authorizes, so every failure joins as before.
export function createPresenceTab(
  cohortId: string,
  ports: PresenceTabPorts,
): PresenceTab {
  const name = presenceLockName(cohortId);
  const initialStatus: PresenceTabStatus = ports.locks ? "checking" : "vacant";
  const listeners = new Set<() => void>();
  let status: PresenceTabStatus = initialStatus;
  let current: Hold | undefined;
  let notices: NoticeChannel | undefined;
  let isOpen = false;
  let probeVersion = 0;

  function setStatus(next: PresenceTabStatus) {
    if (next === status) return;
    status = next;
    if (next === "elsewhere") ports.report("conflict_shown", "pre_join");
    if (next === "taken-over") ports.report("conflict_shown", "taken_over");
    for (const listener of listeners) listener();
  }

  // Only this tab's own lock moves it out of held or taken-over.
  function isDecidedByOwnLock() {
    return status === "held" || status === "taken-over";
  }

  // Probes only read: a probe that briefly took the lock would make another
  // tab's Join fail.
  async function probe(locks: PresenceLocks) {
    const version = (probeVersion += 1);
    const { held = [] } = await locks
      .query()
      .catch((): LockManagerSnapshot => ({}));
    if (version !== probeVersion || isDecidedByOwnLock()) return;
    setStatus(held.some((lock) => lock.name === name) ? "elsewhere" : "vacant");
  }

  function acquire(locks: PresenceLocks, options: LockOptions) {
    return new Promise<boolean>((resolveGranted) => {
      const hold: Hold = { release: () => {}, settled: Promise.resolve() };
      let granted = false;
      hold.settled = locks.request(name, options, (lock) => {
        // A grant that arrives after the session ended is handed straight back.
        if (!lock || !isOpen) return resolveGranted(false);
        return new Promise<void>((release) => {
          granted = true;
          hold.release = release;
          current = hold;
          resolveGranted(true);
        });
      });
      hold.settled.catch(() => {
        if (!granted) return resolveGranted(true);
        if (current !== hold) return;
        current = undefined;
        setStatus("taken-over");
      });
    });
  }

  function announceHeld() {
    probeVersion += 1;
    setStatus("held");
    notices?.notify();
  }

  return {
    async claim() {
      if (status === "held") return true;
      const granted = ports.locks
        ? await acquire(ports.locks, { ifAvailable: true })
        : true;
      if (granted) announceHeld();
      else if (isOpen) setStatus("elsewhere");
      return granted;
    },
    getStatus: () => status,
    open() {
      isOpen = true;
      const locks = ports.locks;
      if (!locks) return () => (isOpen = false);

      const reprobe = () => void probe(locks);
      const channel = ports.openNotices(name, reprobe);
      const stopWaking = ports.subscribeToWake(reprobe);
      notices = channel;
      reprobe();

      return () => {
        isOpen = false;
        stopWaking();
        probeVersion += 1;
        notices = undefined;
        status = initialStatus;
        const hold = current;
        current = undefined;
        if (!hold) return channel.close();

        // WebKit may settle the request before its lock process exposes the
        // release. Querying here orders another tab's later probe after it.
        hold.release();
        const announceRelease = async () => {
          await waitUntilReleased(locks, name);
          channel.notify();
          channel.close();
        };
        void hold.settled.then(announceRelease, announceRelease);
      };
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    async takeOver() {
      const surface = status === "taken-over" ? "taken_over" : "pre_join";
      if (ports.locks) await acquire(ports.locks, { steal: true });
      announceHeld();
      ports.report("moved", surface);
    },
  };
}
