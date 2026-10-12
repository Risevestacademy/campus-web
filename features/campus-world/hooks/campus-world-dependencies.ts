import { publicEnvironment } from "@/config/environment/public";
import { captureBrowserAnalyticsEvent } from "@/core/analytics/client";

import { type CampusRuntime, campusRuntime } from "../game/campus-runtime";
import type { CampusMapPreparationDependencies } from "../services/map/campus-map-preparation.service";

export interface CampusWorldDependencies extends CampusMapPreparationDependencies {
  runtime: CampusRuntime;
}

export const defaultCampusWorldDependencies: CampusWorldDependencies = {
  captureEvent: captureBrowserAnalyticsEvent,
  configuration: {
    dataset: publicEnvironment.NEXT_PUBLIC_SANITY_DATASET,
    projectId: publicEnvironment.NEXT_PUBLIC_SANITY_PROJECT_ID,
  },
  runtime: campusRuntime,
};
