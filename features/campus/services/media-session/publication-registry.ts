import type {
  LocalPublicationChange,
  PublicationSource,
  RemoteMediaPublication,
  RemotePublicationChange,
  RemotePublicationRegistry,
} from "./contracts";

export function upsertRemotePublication(
  registry: RemotePublicationRegistry,
  publication: RemoteMediaPublication,
): RemotePublicationRegistry {
  return {
    ...registry,
    [publication.participantId]: {
      ...registry[publication.participantId],
      [publication.source]: publication,
    },
  };
}

export function removeRemotePublication(
  registry: RemotePublicationRegistry,
  change: Extract<RemotePublicationChange, { type: "removed" }>,
): RemotePublicationRegistry {
  const participantPublications = registry[change.participantId];

  if (!participantPublications) return registry;

  const publication = participantPublications[change.source];

  if (publication?.publicationId !== change.publicationId) return registry;

  const { [change.source]: _removedPublication, ...remainingPublications } =
    participantPublications;

  if (Object.keys(remainingPublications).length > 0) {
    return {
      ...registry,
      [change.participantId]: remainingPublications,
    };
  }

  const { [change.participantId]: _removedParticipant, ...remainingRegistry } =
    registry;
  return remainingRegistry;
}

export function localChangeSource(
  change: LocalPublicationChange,
): PublicationSource {
  return change.type === "removed" ? change.source : change.publication.source;
}
