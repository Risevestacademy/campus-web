import {
  type EntryOutcome,
  isSpaceLocked,
  type Presence,
  type PresenceStore,
  refusedEntryNotice,
  spaceNameOf,
} from "@/core/presence";
import type { WorldSocial } from "@/core/realtime";

import type { EntryRefusal } from "./entry-refusal";

// World refuses a request with an error frame, which nothing reads yet, so a
// request world has not echoed by then is taken as refused.
export const ANSWER_WAIT_MS = 8_000;
export const ENTRY_TOAST_ID = "entry-request";
// World's protocol: "After a no, the same space can be asked again 30 seconds
// later." No frame carries it, so it is kept here.
export const ASK_AGAIN_AFTER_S = 30;

export type EntryLook =
  | "locked"
  | "refused"
  | "asking"
  | "admitted"
  | "declined"
  | "withdrawn"
  | "walked-away"
  | "nobody"
  | "unlocked"
  | "closed"
  | "dropped"
  | "failed";

export interface EntryToastAction {
  label: string;
  onClick: () => void;
  variant?: "default" | "outline";
}

export interface EntryToast {
  actions?: readonly EntryToastAction[];
  description?: string;
  id: string;
  look: EntryLook;
  onClose: () => void;
  priority?: "high";
  timeout?: number;
  title: string;
}

export interface AskToEnterPorts {
  close: (id: string) => void;
  presence: Pick<PresenceStore, "getState" | "subscribe">;
  setTimer: (run: () => void, ms: number) => () => void;
  social: Pick<WorldSocial, "sendRequestEntry" | "sendWithdrawEntryRequest">;
  stepInto: (spaceKey: string) => boolean;
  show: (toast: EntryToast) => void;
}

type State =
  | { kind: "idle" }
  | { kind: "offered"; spaceKey: string }
  | {
      kind: "asking";
      spaceKey: string;
      requestId: string | null;
      withdrawWanted: boolean;
    }
  // The map went while world had not yet confirmed a request: it is
  // withdrawn once world does.
  | { kind: "leaving"; spaceKey: string };

type Ending = EntryOutcome["outcome"] | "dropped";
type Shown = Omit<EntryToast, "id" | "onClose">;

function ownRequest(current: Presence, spaceKey: string) {
  return current.entryRequests.find(
    (open) => open.userId === current.selfId && open.spaceKey === spaceKey,
  );
}

function nameOfPerson(presence: Presence, userId: string | null) {
  if (userId === null) return null;
  return presence.participants.get(userId)?.displayName?.trim() || null;
}

function endingToast(
  ending: Ending,
  name: string,
  { steppedIn, answeredBy }: { steppedIn: boolean; answeredBy: string | null },
): Shown {
  switch (ending) {
    case "admitted":
      return {
        look: "admitted",
        title: `You're in ${name}`,
        description: !steppedIn
          ? "Step in now, before you move away"
          : answeredBy
            ? `${answeredBy} let you in`
            : undefined,
      };
    case "declined":
      return {
        look: "declined",
        title: `Not let into ${name}`,
        description: `You can ask again in ${ASK_AGAIN_AFTER_S} s`,
      };
    case "withdrawn":
      return {
        look: "withdrawn",
        title: "Request withdrawn",
        description: "You can ask again any time",
      };
    case "walked_away":
      return {
        look: "walked-away",
        title: "Request ended",
        description: `You walked away from ${name}`,
      };
    case "nobody_inside":
      return {
        look: "nobody",
        title: "Nobody can answer",
        description: `No one in ${name} can let you in now`,
      };
    case "not_needed":
      return {
        look: "unlocked",
        title: `${name} is open now`,
        description: "Walk in whenever you like",
      };
    case "cancelled":
      return {
        look: "closed",
        title: `${name} isn't taking requests`,
        description: "Its entry rules changed",
      };
    case "dropped":
      return {
        look: "dropped",
        title: "Request ended",
        description: "Your connection to the campus dropped",
      };
    default:
      return { look: "closed", title: `Your request to enter ${name} ended` };
  }
}

// One toast carries the whole ask: the refusal with Ask to enter, the wait
// with Withdraw, then how it ended. Closing it hides it; a request it was
// showing goes on, and its outcome shows when it ends.
export function createAskToEnter({
  close,
  presence,
  setTimer,
  show: showToast,
  social,
  stepInto,
}: AskToEnterPorts) {
  let state: State = { kind: "idle" };
  let shown = 0;
  // Whether a toast that waits on the member (no timeout) is on screen.
  let waiting = false;
  let cancelWait = () => {};

  function nameOf(spaceKey: string) {
    return spaceNameOf(presence.getState(), spaceKey);
  }

  function show(toast: Shown) {
    shown += 1;
    const version = shown;
    waiting = toast.timeout === 0;
    showToast({
      ...toast,
      id: ENTRY_TOAST_ID,
      onClose: () => {
        if (version !== shown) return;
        waiting = false;
        if (state.kind === "offered") state = { kind: "idle" };
      },
    });
  }

  function finish(ending: Ending, answeredBy: string | null = null) {
    if (state.kind !== "asking") return;
    const { spaceKey } = state;
    state = { kind: "idle" };
    cancelWait();
    const steppedIn = ending === "admitted" && stepInto(spaceKey);
    show(
      endingToast(ending, nameOf(spaceKey), {
        steppedIn,
        answeredBy: nameOfPerson(presence.getState(), answeredBy),
      }),
    );
  }

  function fail(spaceKey: string, description: string) {
    state = { kind: "idle" };
    cancelWait();
    show({
      look: "failed",
      title: `Couldn't ask to enter ${nameOf(spaceKey)}`,
      description,
      timeout: 0,
      actions: [
        {
          label: "Try again",
          onClick: () => ask(spaceKey),
          variant: "outline",
        },
      ],
    });
  }

  function withdraw() {
    if (state.kind !== "asking") return;
    if (state.withdrawWanted) return;
    state = { ...state, withdrawWanted: true };
    if (state.requestId !== null) {
      social.sendWithdrawEntryRequest(state.requestId);
    }
  }

  function ask(spaceKey: string) {
    if (!social.sendRequestEntry(spaceKey)) {
      fail(spaceKey, "You're not connected to the campus right now");
      return;
    }
    state = {
      kind: "asking",
      spaceKey,
      requestId: null,
      withdrawWanted: false,
    };
    show({
      look: "asking",
      title: `Asking to enter ${nameOf(spaceKey)}`,
      description: "Waiting to be let in",
      timeout: 0,
      actions: [{ label: "Withdraw", onClick: withdraw, variant: "outline" }],
    });
    cancelWait = setTimer(() => {
      if (state.kind === "asking" && state.requestId === null) {
        fail(spaceKey, "Try again once someone is inside");
      }
    }, ANSWER_WAIT_MS);
  }

  function follow(current: Presence) {
    if (state.kind === "leaving") {
      const request = ownRequest(current, state.spaceKey);
      if (request) {
        social.sendWithdrawEntryRequest(request.requestId);
        end();
      }
      return;
    }
    if (state.kind !== "asking") return;
    if (state.requestId === null) {
      const request = ownRequest(current, state.spaceKey);
      if (!request) return;
      cancelWait();
      const withdrawWanted = state.withdrawWanted;
      state = {
        ...state,
        requestId: request.requestId,
        withdrawWanted: false,
      };
      if (withdrawWanted) withdraw();
      return;
    }

    const { requestId } = state;
    const ended = current.entryOutcomes.find(
      (outcome) => outcome.requestId === requestId,
    );
    if (ended) {
      finish(ended.outcome, ended.answeredBy);
    } else if (
      !current.entryRequests.some((open) => open.requestId === requestId)
    ) {
      finish("dropped");
    }
  }

  const unsubscribe = presence.subscribe(follow);

  function end() {
    state = { kind: "idle" };
    cancelWait();
    unsubscribe();
  }

  return {
    refused({ mayAsk, spaceKey }: EntryRefusal) {
      if (state.kind === "asking" || state.kind === "leaving") return;
      const current = presence.getState();
      const title = refusedEntryNotice(current, spaceKey);
      const locked = spaceKey !== null && isSpaceLocked(current, spaceKey);
      // A refused step says nothing about asking, so only a lock offers it.
      if (spaceKey === null || !(mayAsk ?? locked)) {
        state = { kind: "idle" };
        show({ look: locked ? "locked" : "refused", title, priority: "high" });
        return;
      }
      state = { kind: "offered", spaceKey };
      show({
        look: locked ? "locked" : "refused",
        title,
        description: "Someone inside can let you in",
        priority: "high",
        timeout: 0,
        actions: [{ label: "Ask to enter", onClick: () => ask(spaceKey) }],
      });
    },
    // The map is going, and nothing would follow a request after it: a
    // waiting toast closes and an open request is withdrawn.
    stop() {
      if (waiting) close(ENTRY_TOAST_ID);
      waiting = false;
      if (state.kind !== "asking") {
        end();
        return;
      }
      if (state.requestId !== null) {
        withdraw();
        end();
        return;
      }
      state = { kind: "leaving", spaceKey: state.spaceKey };
      cancelWait();
      cancelWait = setTimer(end, ANSWER_WAIT_MS);
    },
  };
}
