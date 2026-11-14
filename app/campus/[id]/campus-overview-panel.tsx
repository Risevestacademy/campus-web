"use client";

import type { ComponentProps } from "react";

import { MemberProfileCard } from "@/features/profile";
import { CampusOverviewPanel } from "@/features/roster";

// The roster's rows open the profile feature's card; features may not import
// each other, so the route joins them here.
export function OverviewPanelWithProfiles(
  props: Omit<ComponentProps<typeof CampusOverviewPanel>, "ProfileCard">,
) {
  return <CampusOverviewPanel {...props} ProfileCard={MemberProfileCard} />;
}
