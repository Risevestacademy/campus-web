import type * as Livekit from "livekit-client";

import type { ConnectionCheckProbe } from "./run-connection-check";

export type LivekitModule = Pick<
  typeof Livekit,
  "Checker" | "CheckStatus" | "ConnectionCheck"
>;

interface MediaGrant {
  url: string;
  token: string;
}

// LiveKit's own publish check waits as long before reading the sender stats.
const PUBLISH_WAIT_MS = 3000;

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function packetsSentBy(sender: RTCRtpSender | undefined) {
  let packetsSent = 0;
  (await sender?.getStats())?.forEach((stat) => {
    if (stat.type === "outbound-rtp") packetsSent += stat.packetsSent ?? 0;
  });
  return packetsSent;
}

// The SDK's checkPublishAudio/Video open the default device, even one the
// member turned off. This publishes a copy of the member's own track instead;
// the copy, never their track, is stopped, so the preview keeps running.
function publishCheckFor(
  Checker: LivekitModule["Checker"],
  track: MediaStreamTrack,
) {
  return class PublishLiveTrackCheck extends Checker {
    get description() {
      return `Can publish ${track.kind}`;
    }

    protected async perform() {
      const room = await this.connect();
      const copy = track.clone();

      try {
        const publication = await room.localParticipant.publishTrack(copy);
        await wait(PUBLISH_WAIT_MS);

        if ((await packetsSentBy(publication.track?.sender)) === 0) {
          throw new Error(`No ${track.kind} packets were sent.`);
        }
      } finally {
        copy.stop();
      }
    }
  };
}

export async function loadLivekitProbe(
  { url, token }: MediaGrant,
  load: () => Promise<LivekitModule> = () => import("livekit-client"),
): Promise<ConnectionCheckProbe> {
  const { Checker, CheckStatus, ConnectionCheck } = await load();
  const connectionCheck = new ConnectionCheck(url, token);
  const passed = ({ status }: Livekit.CheckInfo) =>
    status === CheckStatus.SUCCESS || status === CheckStatus.SKIPPED;
  const networkChecks = [
    () => connectionCheck.checkWebsocket(),
    () => connectionCheck.checkWebRTC(),
    () => connectionCheck.checkTURN(),
  ];

  return {
    async network() {
      for (const check of networkChecks) {
        if (!passed(await check())) return false;
      }
      return true;
    },
    async publish(track) {
      return passed(
        await connectionCheck.createAndRunCheck(
          publishCheckFor(Checker, track),
        ),
      );
    },
  };
}
