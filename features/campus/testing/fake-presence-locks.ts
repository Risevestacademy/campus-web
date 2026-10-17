import type {
  NoticeChannel,
  PresenceLocks,
} from "../services/presence-session/presence-tab";

interface Holder {
  clientId: string;
  steal: (reason: DOMException) => void;
}

// One origin's Web Locks, shared by simulated tabs. Grants and steals follow
// the W3C spec: a stolen holder's request rejects with AbortError, and a
// crashed tab's locks vanish without any callback settling.
export function createFakeLockManager() {
  const held = new Map<string, Holder>();

  function release(name: string, holder: Holder) {
    if (held.get(name) === holder) held.delete(name);
  }

  function forClient(clientId: string): PresenceLocks {
    return {
      async query() {
        return {
          held: [...held].map(([name, holder]) => ({
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
