import {
  ownSpaceKeyOf,
  type Presence,
  type PresenceStore,
} from "@/core/presence";
import type { WorldSocial } from "@/core/realtime";

const UNNAMED_PERSON = "Campus member";

export interface EntryAnswerToast {
  askerId: string;
  askerName: string;
  id: string;
  onAnswer: (admit: boolean) => void;
  onClose: () => void;
  // The last answer could not be sent, as while the socket is down.
  unsent: boolean;
}

export interface AnswerPorts {
  close: (id: string) => void;
  presence: Pick<PresenceStore, "getState" | "subscribe">;
  show: (toast: EntryAnswerToast) => void;
  social: Pick<WorldSocial, "sendAnswerEntryRequest">;
}

function firstNameOf(displayName: string | null | undefined): string {
  return displayName?.trim().split(/\s+/)[0] || UNNAMED_PERSON;
}

function toastIdOf(requestId: string) {
  return `entry-answer-${requestId}`;
}

function answerable({
  entryRequests,
  selfId,
  ...presence
}: Presence): Set<string> {
  const ownSpace = ownSpaceKeyOf({ selfId, ...presence });
  return new Set(
    entryRequests
      .filter(
        ({ userId, spaceKey }) => userId !== selfId && spaceKey === ownSpace,
      )
      .map(({ requestId }) => requestId),
  );
}

// One toast per request the member can answer: world only sends them to
// whoever may, and only while they stand in the space. A request that ends,
// whoever answered it, or a step out of the space closes it quietly; stepping
// back in while it is open shows it again. Only closing or answering it sets
// it aside until it ends.
export function answerEntryRequests({
  close,
  presence,
  show,
  social,
}: AnswerPorts): () => void {
  const shown = new Set<string>();
  const setAside = new Set<string>();

  function hide(requestId: string) {
    shown.delete(requestId);
    close(toastIdOf(requestId));
  }

  function present(
    { requestId, userId }: Presence["entryRequests"][number],
    current: Presence,
    unsent: boolean,
  ) {
    show({
      askerId: userId,
      askerName: firstNameOf(current.participants.get(userId)?.displayName),
      id: toastIdOf(requestId),
      onAnswer: (admit) => {
        if (!shown.has(requestId)) return;
        if (!social.sendAnswerEntryRequest(requestId, admit)) {
          const request = presence
            .getState()
            .entryRequests.find((open) => open.requestId === requestId);
          if (request) present(request, presence.getState(), true);
          return;
        }
        setAside.add(requestId);
        hide(requestId);
      },
      onClose: () => {
        if (!shown.has(requestId)) return;
        shown.delete(requestId);
        setAside.add(requestId);
      },
      unsent,
    });
  }

  function follow(current: Presence) {
    const open = answerable(current);
    for (const requestId of shown) {
      if (!open.has(requestId)) hide(requestId);
    }
    for (const requestId of setAside) {
      if (!current.entryRequests.some((r) => r.requestId === requestId)) {
        setAside.delete(requestId);
      }
    }
    for (const request of current.entryRequests) {
      const { requestId } = request;
      if (!open.has(requestId) || shown.has(requestId)) continue;
      if (setAside.has(requestId)) continue;
      shown.add(requestId);
      present(request, current, false);
    }
  }

  follow(presence.getState());
  const unsubscribe = presence.subscribe(follow);
  return () => {
    unsubscribe();
    for (const requestId of shown) close(toastIdOf(requestId));
    shown.clear();
  };
}
