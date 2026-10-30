import { publicEnvironment } from "@/config/environment/public";
import { captureBrowserAnalyticsEvent } from "@/core/analytics/client";
import { ANALYTICS_EVENTS } from "@/core/analytics/events";

import { pinMediaUrl, readMediaOrigin } from "../connection-check/media-origin";
import { createCallAudioSession } from "./call-audio-session";
import type { CallAudioSession } from "./contracts";
import { createLivekitMeetingRoomTransport } from "./livekit-meeting-room-transport";

// Reads the origin per call: an invalid NEXT_PUBLIC_MEDIA_URL then fails the
// join (audio unavailable) instead of the whole Presence Session.
function pinToMediaOrigin(url: string) {
  const mediaOrigin = readMediaOrigin(publicEnvironment);
  return mediaOrigin ? pinMediaUrl(url, mediaOrigin) : undefined;
}

export function createBrowserCallAudioSession(
  refreshCall: () => boolean,
): CallAudioSession {
  return createCallAudioSession({
    now: () => performance.now(),
    pinMediaUrl: pinToMediaOrigin,
    recordFirstAudioMilliseconds: (firstAudioMilliseconds, hearing) =>
      captureBrowserAnalyticsEvent(
        ANALYTICS_EVENTS.CAMPUS_PROXIMITY_AUDIO_READY,
        { first_audio_ms: firstAudioMilliseconds, hearing },
      ),
    refreshCall,
    roomTransport: createLivekitMeetingRoomTransport(),
  });
}
