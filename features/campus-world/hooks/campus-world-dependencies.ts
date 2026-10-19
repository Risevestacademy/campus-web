import { publicEnvironment } from "@/config/environment/public";
import { captureBrowserAnalyticsEvent } from "@/core/analytics/client";
import { presenceFor, type PresenceStore } from "@/core/presence";

import { type CampusRuntime, campusRuntime } from "../game/campus-runtime";
import type { CampusMapPreparationDependencies } from "../services/map/campus-map-preparation.service";

export interface CampusMapDependencies extends CampusMapPreparationDependencies {
  runtime: CampusRuntime;
}

export interface CampusWorldDependencies extends CampusMapDependencies {
  presence: (cohortId: string) => PresenceStore;
}

export const defaultCampusWorldDependencies: CampusWorldDependencies = {
  captureEvent: captureBrowserAnalyticsEvent,
  configuration: {
    dataset: publicEnvironment.NEXT_PUBLIC_SANITY_DATASET,
    projectId: publicEnvironment.NEXT_PUBLIC_SANITY_PROJECT_ID,
  },
  presence: presenceFor,
  runtime: campusRuntime,
};
