import type { PreparedCampusMap } from "../services/map/prepare-campus-map";

export interface CampusGame {
  quit: () => void;
}

export interface StartCampusGameDependencies {
  onRenderError: (mapId: string) => void;
}

export type StartCampusGame = (
  container: HTMLElement,
  canvas: HTMLCanvasElement,
  prepared: PreparedCampusMap,
  dependencies: StartCampusGameDependencies,
) => Promise<CampusGame>;
