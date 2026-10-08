import type { TrackSummary } from "../types/track.types";
import { TrackAdministrationActions } from "./track-administration-actions";
export function TrackAdministrationCard({ track }: { track: TrackSummary }) {
  return (
    <article className="relative w-fit">
      <div className="block w-fit pr-10">
        <figure className="bg-surface ring-border mb-2 block aspect-video w-80 rounded-2xl ring" />
        <h3 className="line-clamp-1 pl-2 font-medium">{track.name}</h3>
        <p className="text-foreground-secondary pl-2 text-sm">{track.code}</p>
      </div>
      <div className="absolute right-0 bottom-0">
        <TrackAdministrationActions track={track} />
      </div>
    </article>
  );
}
