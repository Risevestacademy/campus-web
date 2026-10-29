import type { ComponentType, ReactNode } from "react";

import { Avatar, AvatarFallback } from "@/shared/ui/avatar";
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
import { railPanelItems } from "./rail-items";
import { SidebarCollapseButton } from "./sidebar-collapse-button";
import { SidebarComingSoonPanel } from "./sidebar-coming-soon-panel";

type CampusShellProps = Readonly<{
  AccountMenu?: ComponentType<{ children: ReactNode }>;
  administrationPanel?: ReactNode;
  FeedbackPopup?: FeedbackPopupComponent;
  OverviewPanel: ComponentType<{ collapseButton: ReactNode }>;
  children: ReactNode;
  cohortId: string;
  initialSidebarMode?: SidebarMode;
  viewer?: CampusViewer;
}>;

const CURRENT_USER_INITIAL = "J";
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

function RailAvatar() {
  return (
    <Avatar size="lg">
      <AvatarFallback className="bg-accent text-accent-foreground font-medium">
        {CURRENT_USER_INITIAL}
      </AvatarFallback>
    </Avatar>
  );
}

export function CampusShell({
  AccountMenu,
  administrationPanel,
  FeedbackPopup,
  OverviewPanel,
  children,
  cohortId,
  initialSidebarMode,
  viewer,
}: CampusShellProps) {
  const avatar = <RailAvatar />;

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
                AccountMenu ? <AccountMenu>{avatar}</AccountMenu> : avatar
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
                map: <OverviewPanel collapseButton={collapseButton} />,
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
