import { publicEnvironment } from "@/config/environment/public";
import { captureBrowserAnalyticsEvent } from "@/core/analytics/client";
import { ANALYTICS_EVENTS } from "@/core/analytics/events";

import { pinMediaUrl, readMediaOrigin } from "../connection-check/media-origin";
import type { ProximityAudioSession } from "./contracts";
import { createLivekitMeetingRoomTransport } from "./livekit-meeting-room-transport";
import { createProximityAudioSession } from "./proximity-audio-session";

// Reads the origin per call: an invalid NEXT_PUBLIC_MEDIA_URL then fails the
// join (audio unavailable) instead of the whole Presence Session.
function pinToMediaOrigin(url: string) {
  const mediaOrigin = readMediaOrigin(publicEnvironment);
  return mediaOrigin ? pinMediaUrl(url, mediaOrigin) : undefined;
}

export function createBrowserProximityAudioSession(
  refreshCall: () => boolean,
): ProximityAudioSession {
  return createProximityAudioSession({
    now: () => performance.now(),
    pinMediaUrl: pinToMediaOrigin,
    recordFirstAudioMilliseconds: (firstAudioMilliseconds) =>
      captureBrowserAnalyticsEvent(
        ANALYTICS_EVENTS.CAMPUS_PROXIMITY_AUDIO_READY,
        { first_audio_ms: firstAudioMilliseconds },
      ),
    refreshCall,
    roomTransport: createLivekitMeetingRoomTransport(),
  });
}
