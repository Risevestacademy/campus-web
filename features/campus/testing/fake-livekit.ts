import { type Mock, vi } from "vitest";

import type { LivekitModule } from "../services/connection-check/livekit-probe";

type FakeCheckStatus = "SUCCESS" | "SKIPPED" | "FAILED";

const CheckStatus = {
  IDLE: 0,
  RUNNING: 1,
  SKIPPED: 2,
  SUCCESS: 3,
  FAILED: 4,
} as const;

export type FakeTrack = MediaStreamTrack &
  Readonly<{ stop: Mock; copy: MediaStreamTrack & { stop: Mock } }>;

export function fakeTrack(kind: "audio" | "video"): FakeTrack {
  const copy = { kind, stop: vi.fn() };
  return {
    kind,
    stop: vi.fn(),
    clone: () => copy,
    copy,
  } as unknown as FakeTrack;
}

// Mirrors the slice of livekit-client the probe uses: a Checker's run()
// catches what perform() throws and reports FAILED, as the SDK's does.
export function fakeLivekit({
  websocket = "SUCCESS",
  webrtc = "SUCCESS",
  turn = "SUCCESS",
  packetsSent = 100,
  publishFails = false,
}: {
  websocket?: FakeCheckStatus;
  webrtc?: FakeCheckStatus;
  turn?: FakeCheckStatus;
  packetsSent?: number;
  publishFails?: boolean;
} = {}) {
  const constructed: { url: string; token: string }[] = [];
  const ran: string[] = [];
  const published: MediaStreamTrack[] = [];

  const room = {
    localParticipant: {
      async publishTrack(track: MediaStreamTrack) {
        if (publishFails) throw new Error("publish failed");
        published.push(track);
        const stats = new Map([["out", { type: "outbound-rtp", packetsSent }]]);
        return { track: { sender: { getStats: async () => stats } } };
      },
    },
  };

  abstract class Checker {
    status: number = CheckStatus.IDLE;

    constructor(
      protected url: string,
      protected token: string,
    ) {}

    abstract get description(): string;

    protected abstract perform(): Promise<void>;

    protected async connect() {
      return room;
    }

    async run() {
      try {
        await this.perform();
        this.status = CheckStatus.SUCCESS;
      } catch {
        this.status = CheckStatus.FAILED;
      }
      return {
        name: "",
        description: this.description,
        logs: [],
        status: this.status,
      };
    }
  }

  function info(name: string, status: FakeCheckStatus) {
    ran.push(name);
    return Promise.resolve({
      name,
      description: name,
      logs: [],
      status: CheckStatus[status],
    });
  }

  class ConnectionCheck {
    constructor(
      private url: string,
      private token: string,
    ) {
      constructed.push({ url, token });
    }

    checkWebsocket() {
      return info("websocket", websocket);
    }

    checkWebRTC() {
      return info("webrtc", webrtc);
    }

    checkTURN() {
      return info("turn", turn);
    }

    createAndRunCheck(Check: new (url: string, token: string) => Checker) {
      return new Check(this.url, this.token).run();
    }
  }

  return {
    module: {
      Checker,
      CheckStatus,
      ConnectionCheck,
    } as unknown as LivekitModule,
    constructed,
    ran,
    published,
  };
}
