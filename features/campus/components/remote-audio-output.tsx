"use client";

import { useMediaElementRef } from "../hooks/use-media-element-ref";
import { useRemoteAudioVolume } from "../hooks/use-remote-audio-volume";
import type { RemoteMediaPublication } from "../services/media-session/contracts";
import { useMediaSession } from "../services/media-session/media-session-provider";

type AudioProps = Readonly<{
  outputDeviceId: string;
  publication: RemoteMediaPublication;
}>;

function RemoteAudio({ outputDeviceId, publication }: AudioProps) {
  const volume = useRemoteAudioVolume(publication.participantId);
  const audioRef = useMediaElementRef(publication, outputDeviceId, volume);

  return (
    <audio
      ref={audioRef}
      autoPlay
      aria-label={`${publication.participantId} audio`}
    />
  );
}

// Full volume over everything else, and nothing turns it down.
function BroadcastAudio({ outputDeviceId, publication }: AudioProps) {
  const audioRef = useMediaElementRef(publication, outputDeviceId);

  return (
    <audio
      ref={audioRef}
      autoPlay
      aria-label={`${publication.participantId} broadcast audio`}
    />
  );
}

// One mix for the whole Presence Session, so changing page or meeting layout
// never interrupts what the member hears.
export function RemoteAudioOutput() {
  const remotePublications = useMediaSession(
    (state) => state.remotePublications,
  );
  const broadcastPublications = useMediaSession(
    (state) => state.broadcastPublications,
  );
  const outputDeviceId = useMediaSession(
    (state) => state.output.selectedDeviceId,
  );

  return (
    <>
      {Object.values(remotePublications).map(({ microphone }) =>
        microphone ? (
          <RemoteAudio
            key={microphone.publicationId}
            outputDeviceId={outputDeviceId}
            publication={microphone}
          />
        ) : null,
      )}
      {Object.values(broadcastPublications).map((microphone) => (
        <BroadcastAudio
          key={microphone.publicationId}
          outputDeviceId={outputDeviceId}
          publication={microphone}
        />
      ))}
    </>
  );
}
