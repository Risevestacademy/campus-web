import "server-only";

import { publicEnvironment } from "@/config/environment/public";
import { getServerApi } from "@/core/api/client/server";

import { Notice } from "../../notice";
import { readGrantOptions } from "../services/grant-options.service";
import { listSpaces, readEntryMap } from "../services/maps-api.adapter";
import { readPublishedEntryMap } from "../services/published-map.service";
import type { SpacesRead } from "../types/maps.types";
import { MapWorkspace } from "./map-workspace";

export async function MapsAdministration({ cohortId }: { cohortId: string }) {
  const api = await getServerApi();
  const [published, entry, grantOptions] = await Promise.all([
    readPublishedEntryMap({
      dataset: publicEnvironment.NEXT_PUBLIC_SANITY_DATASET,
      projectId: publicEnvironment.NEXT_PUBLIC_SANITY_PROJECT_ID,
      fetch,
    }),
    readEntryMap(api),
    readGrantOptions(api, cohortId),
  ]);
  const entryMap = entry.kind === "loaded" ? entry.map : null;
  // Until the campus holds the map Sanity serves, it has no spaces of it.
  const spaces: SpacesRead =
    published.kind === "loaded" && entryMap?.key === published.map.mapKey
      ? await listSpaces(api, entryMap.id)
      : { kind: "loaded", spaces: [] };

  return (
    <section
      aria-labelledby="maps-heading"
      className="grid content-start gap-6 p-10"
    >
      <header>
        <h1 id="maps-heading" className="font-display text-3xl font-semibold">
          Maps
        </h1>
      </header>
      {published.kind === "not-configured" ? (
        <Notice>
          This deployment isn&apos;t told where the campus maps are published,
          so there is no map to show.
        </Notice>
      ) : published.kind === "unavailable" ? (
        <Notice>
          We couldn&apos;t read the published campus map from Sanity. Refresh to
          try again.
        </Notice>
      ) : entry.kind === "unavailable" || spaces.kind === "unavailable" ? (
        <Notice>
          We couldn&apos;t load the campus&apos;s maps and spaces. Refresh to
          try again.
        </Notice>
      ) : (
        <MapWorkspace
          map={published.map}
          entry={entryMap}
          spaces={spaces.spaces}
          cohortId={cohortId}
          grantOptions={grantOptions}
        />
      )}
    </section>
  );
}
