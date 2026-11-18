import type { Presence } from "@/core/presence";

export type QuickTransportDestination = {
  id: string;
  label: string;
  to:
    | { kind: "space"; spaceKey: string }
    | { kind: "tile"; x: number; y: number };
};

// The spaces drawn on the campus map, by the key world names them with.
const SPACES = [
  { label: "Townhall", spaceKey: "town_hall" },
  { label: "Library", spaceKey: "library" },
  { label: "Notice room", spaceKey: "notice_room" },
  { label: "Admin room", spaceKey: "admin" },
] as const;

// The courtyard and the area between the private rooms are not spaces: world
// draws only the courtyard's four spaces and the rooms, and everything around
// them is the corridors and grounds, which world walks to by tile. These are
// open tiles read from the published "campus" map (version d686dbad05445e71):
// one beside the spawn, north of the fountain, and one in the middle of the
// four private rooms. They are the map's, so they are only offered on it.
const CAMPUS_MAP_ID = "campus";
const AREAS = [
  { label: "Courtyard", x: 75, y: 60 },
  { label: "Private room area", x: 118, y: 78 },
] as const;

// Spaces appear once world has named them, so one the map no longer draws
// never shows. Areas follow the spaces.
export function quickTransportDestinationsOf({
  map,
  spaceNames,
}: Pick<Presence, "map" | "spaceNames">): QuickTransportDestination[] {
  const spaces = SPACES.filter(({ spaceKey }) => spaceNames.has(spaceKey)).map(
    ({ label, spaceKey }): QuickTransportDestination => ({
      id: spaceKey,
      label,
      to: { kind: "space", spaceKey },
    }),
  );
  const areas =
    map?.id === CAMPUS_MAP_ID
      ? AREAS.map(({ label, x, y }): QuickTransportDestination => ({
          id: `tile-${x}-${y}`,
          label,
          to: { kind: "tile", x, y },
        }))
      : [];

  return [...spaces, ...areas];
}
