import type { ComponentType, ReactNode } from "react";

import type { components } from "@/core/api/client";
import { TooltipProvider } from "@/shared/ui/tooltip";

import { closeFeedbackPanel } from "../../store/feedback-panel-store";
import type {
  SidebarMode,
  SidebarPanelId,
} from "../../store/sidebar-preferences";
import { CampusViewProvider } from "../campus-view-provider";
import { CampusRail } from "./campus-rail";
import { CampusSidebar } from "./campus-sidebar";
import {
  type CampusViewer,
  FeedbackLayer,
  type FeedbackPopupComponent,
} from "./feedback-layer";
import {
  type LogOutActionComponent,
  type OwnProfileActionComponent,
  RailAccount,
} from "./rail-account";
import { railPanelItems } from "./rail-items";
import { SidebarCollapseButton } from "./sidebar-collapse-button";
import { SidebarComingSoonPanel } from "./sidebar-coming-soon-panel";

// The member's place in this cohort, as the overview panel labels it.
type OverviewCohort = {
  name: string;
  role?: components["schemas"]["CohortRole"];
};

type CampusShellProps = Readonly<{
  administrationPanel?: ReactNode;
  FeedbackPopup?: FeedbackPopupComponent;
  LogOutAction?: LogOutActionComponent;
  OwnProfileAction?: OwnProfileActionComponent;
  OverviewPanel: ComponentType<{
    cohort?: OverviewCohort;
    cohortId: string;
    collapseButton: ReactNode;
  }>;
  children: ReactNode;
  cohort?: OverviewCohort;
  cohortId: string;
  initialSidebarMode?: SidebarMode;
  viewer?: CampusViewer;
}>;

const collapseButton = <SidebarCollapseButton />;

const comingSoonPanels = Object.fromEntries(
  railPanelItems
    .filter((item) => item.id !== "map")
    .map((item) => [
      item.id,
      <SidebarComingSoonPanel
        key={item.id}
        title={item.label}
        Icon={item.Icon}
        collapseButton={collapseButton}
      />,
    ]),
) as Record<Exclude<SidebarPanelId, "map">, ReactNode>;

export function CampusShell({
  LogOutAction,
  OwnProfileAction,
  administrationPanel,
  FeedbackPopup,
  OverviewPanel,
  children,
  cohort,
  cohortId,
  initialSidebarMode,
  viewer,
}: CampusShellProps) {
  return (
    <CampusViewProvider>
      <TooltipProvider>
        <main
          data-surface-role="background"
          className="bg-background text-foreground flex h-dvh gap-1.5 p-1.5"
        >
          {/* The feedback popup covers only the content area, so using the
              rail or the sidebar closes it, as a click on its backdrop does.
              The capture phase runs first, so "Report an issue" still opens. */}
          <div className="contents" onClickCapture={closeFeedbackPanel}>
            <CampusRail
              account={
                <RailAccount
                  cohortId={cohortId}
                  LogOutAction={LogOutAction}
                  OwnProfileAction={OwnProfileAction}
                  viewer={viewer}
                />
              }
              cohortId={cohortId}
              hasAdministration={administrationPanel !== undefined}
              initialSidebarMode={initialSidebarMode}
            />
            <CampusSidebar
              administrationPanel={administrationPanel}
              initialMode={initialSidebarMode}
              panels={{
                ...comingSoonPanels,
                map: (
                  <OverviewPanel
                    cohort={cohort}
                    cohortId={cohortId}
                    collapseButton={collapseButton}
                  />
                ),
              }}
            />
          </div>
          <FeedbackLayer
            FeedbackPopup={FeedbackPopup}
            cohortId={cohortId}
            viewer={viewer}
          >
            {children}
          </FeedbackLayer>
        </main>
      </TooltipProvider>
    </CampusViewProvider>
  );
}
