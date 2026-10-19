import type {
  NoticeChannel,
  PresenceLocks,
} from "../services/presence-session/presence-tab";

interface Holder {
  clientId: string;
  steal: (reason: DOMException) => void;
}

interface ReleasedHolder {
  holder: Holder;
  remainingQueries: number;
}

// One origin's Web Locks, shared by simulated tabs. Grants and steals follow
// the W3C spec: a stolen holder's request rejects with AbortError, and a
// crashed tab's locks vanish without any callback settling.
export function createFakeLockManager({
  releaseLag = 0,
}: { releaseLag?: number } = {}) {
  const held = new Map<string, Holder>();
  const released = new Map<string, ReleasedHolder>();

  function release(name: string, holder: Holder) {
    if (held.get(name) !== holder) return;
    held.delete(name);
    if (releaseLag > 0) {
      released.set(name, { holder, remainingQueries: releaseLag });
    }
  }

  function visibleHolders() {
    const visible = new Map(held);
    for (const [name, releasedHolder] of released) {
      if (!visible.has(name)) visible.set(name, releasedHolder.holder);
      releasedHolder.remainingQueries -= 1;
      if (releasedHolder.remainingQueries === 0) released.delete(name);
    }
    return visible;
  }

  function forClient(clientId: string): PresenceLocks {
    return {
      async query() {
        return {
          held: [...visibleHolders()].map(([name, holder]) => ({
            clientId: holder.clientId,
            mode: "exclusive" as const,
            name,
          })),
          pending: [],
        };
      },
      async request<T>(
        name: string,
        options: LockOptions,
        callback: LockGrantedCallback<T>,
      ): Promise<T> {
        const current = held.get(name);
        if (current && options.ifAvailable) return callback(null);
        if (current && !options.steal) {
          throw new Error("The fake lock manager does not queue requests.");
        }
        if (current) {
          held.delete(name);
          current.steal(new DOMException("Lock stolen", "AbortError"));
        }

        return new Promise<T>((resolve, reject) => {
          const holder: Holder = { clientId, steal: reject };
          released.delete(name);
          held.set(name, holder);
          Promise.resolve(callback({ mode: "exclusive", name })).then(
            (value) => {
              release(name, holder);
              resolve(value);
            },
            (error: unknown) => {
              release(name, holder);
              reject(error);
            },
          );
        });
      },
    };
  }

  return {
    crash(clientId: string) {
      for (const [name, holder] of held) {
        if (holder.clientId === clientId) held.delete(name);
      }
      for (const [name, { holder }] of released) {
        if (holder.clientId === clientId) released.delete(name);
      }
    },
    forClient,
    holderOf: (name: string) => held.get(name)?.clientId,
  };
}

// BroadcastChannel semantics: a notice reaches every other open channel of the
// same name, asynchronously, and never the sender.
export function createFakeNoticeBus() {
  const channels = new Map<string, Set<() => void>>();

  return function openNotices(
    name: string,
    onNotice: () => void,
  ): NoticeChannel {
    const members = channels.get(name) ?? new Set<() => void>();
    channels.set(name, members);
    const member = () => onNotice();
    members.add(member);

    return {
      close: () => members.delete(member),
      notify() {
        for (const other of members) {
          if (other !== member) queueMicrotask(other);
        }
      },
    };
  };
}

// Lets queued notices, probes and lock grants finish.
export function settle(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}
