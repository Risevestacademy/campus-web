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
// whoever answered it, or a step out of the space closes it quietly.
export function answerEntryRequests({
  close,
  presence,
  show,
  social,
}: AnswerPorts): () => void {
  const shown = new Set<string>();
  const setAside = new Set<string>();

  function forget(requestId: string) {
    shown.delete(requestId);
    setAside.add(requestId);
    close(toastIdOf(requestId));
  }

  function follow(current: Presence) {
    const open = answerable(current);
    for (const requestId of shown) {
      if (!open.has(requestId)) forget(requestId);
    }
    for (const requestId of setAside) {
      if (!current.entryRequests.some((r) => r.requestId === requestId)) {
        setAside.delete(requestId);
      }
    }
    for (const request of current.entryRequests) {
      const { requestId, userId } = request;
      if (!open.has(requestId) || shown.has(requestId)) continue;
      if (setAside.has(requestId)) continue;
      shown.add(requestId);
      show({
        askerId: userId,
        askerName: firstNameOf(current.participants.get(userId)?.displayName),
        id: toastIdOf(requestId),
        onAnswer: (admit) => {
          social.sendAnswerEntryRequest(requestId, admit);
          forget(requestId);
        },
        onClose: () => {
          if (!shown.has(requestId)) return;
          shown.delete(requestId);
          setAside.add(requestId);
        },
      });
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
