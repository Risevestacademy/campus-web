import type {
  ActiveMessage,
  AnswerEntryRequestMessage,
  MuteMessage,
  RemoveFromSpaceMessage,
  RequestEntryMessage,
  SayMessage,
  SetLockMessage,
  SetStatusMessage,
  WithdrawEntryRequestMessage,
} from "./generated/world-protocol";
import type { ServerMessage } from "./server-message.schema";

// World's limits. It answers a line or a timer outside them with an error, so
// a view checks against these and the channel refuses to send past them.
export const SAY_MAX_LENGTH = 500;
export const STATUS_DURATION_MIN_SECONDS = 60;
export const STATUS_DURATION_MAX_SECONDS = 43_200;

export type WorldSocialMessage =
  | SetStatusMessage
  | ActiveMessage
  | SayMessage
  | SetLockMessage
  | RequestEntryMessage
  | WithdrawEntryRequestMessage
  | AnswerEntryRequestMessage
  | MuteMessage
  | RemoveFromSpaceMessage;

// Each sender returns whether the frame was handed to the socket, as
// `WorldMovement`'s do: false while there is no admitted socket, and for a
// value world would refuse.
export interface WorldSocial {
  sendActive(): boolean;
  sendAnswerEntryRequest(requestId: string, admit: boolean): boolean;
  sendMute(userId: string): boolean;
  sendRemoveFromSpace(userId: string): boolean;
  sendRequestEntry(spaceKey: string): boolean;
  sendSay(text: string): boolean;
  sendSetLock(locked: boolean): boolean;
  sendSetStatus(
    status: SetStatusMessage["status"],
    forSeconds?: number,
  ): boolean;
  sendWithdrawEntryRequest(requestId: string): boolean;
}

export interface WorldSocialChannel extends WorldSocial {
  apply(message: ServerMessage): void;
  bind(send: (message: WorldSocialMessage) => boolean): () => void;
  disconnect(): void;
}

function isValidDuration(seconds: number): boolean {
  return (
    Number.isInteger(seconds) &&
    seconds >= STATUS_DURATION_MIN_SECONDS &&
    seconds <= STATUS_DURATION_MAX_SECONDS
  );
}

export function createWorldSocialChannel(): WorldSocialChannel {
  let binding = 0;
  let welcomed = false;
  let ready = false;
  let send: ((message: WorldSocialMessage) => boolean) | undefined;

  function sendWhenReady(message: WorldSocialMessage): boolean {
    if (!ready || !send) return false;
    return send(message);
  }

  return {
    apply(message) {
      if (message.type === "welcome") {
        welcomed = true;
        ready = false;
      } else if (message.type === "snapshot") {
        ready = welcomed;
      }
    },
    bind(nextSend) {
      binding += 1;
      const currentBinding = binding;
      send = nextSend;

      return () => {
        if (binding !== currentBinding) return;
        send = undefined;
        welcomed = false;
        ready = false;
      };
    },
    disconnect() {
      ready = false;
    },
    sendActive: () => sendWhenReady({ type: "active" }),
    sendAnswerEntryRequest: (requestId, admit) =>
      sendWhenReady({ type: "answerEntryRequest", requestId, admit }),
    sendMute: (userId) => sendWhenReady({ type: "mute", userId }),
    sendRemoveFromSpace: (userId) =>
      sendWhenReady({ type: "removeFromSpace", userId }),
    sendRequestEntry: (spaceKey) =>
      sendWhenReady({ type: "requestEntry", spaceKey }),
    sendSay(text) {
      const line = text.trim();
      if (line.length === 0 || line.length > SAY_MAX_LENGTH) return false;
      return sendWhenReady({ type: "say", text: line });
    },
    sendSetLock: (locked) => sendWhenReady({ type: "setLock", locked }),
    sendSetStatus(status, forSeconds) {
      if (forSeconds === undefined) {
        return sendWhenReady({ type: "setStatus", status });
      }
      if (!isValidDuration(forSeconds)) return false;
      return sendWhenReady({ type: "setStatus", status, forSeconds });
    },
    sendWithdrawEntryRequest: (requestId) =>
      sendWhenReady({ type: "withdrawEntryRequest", requestId }),
  };
}

const cohortChannels = new Map<string, WorldSocialChannel>();

// One per cohort per document, like the movement channel and the presence
// store it travels beside.
export function socialFor(cohortId: string): WorldSocialChannel {
  let channel = cohortChannels.get(cohortId);
  if (!channel) {
    channel = createWorldSocialChannel();
    cohortChannels.set(cohortId, channel);
  }
  return channel;
}
