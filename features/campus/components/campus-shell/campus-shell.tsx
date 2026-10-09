import type { ComponentType, ReactNode } from "react";

import { Avatar, AvatarFallback } from "@/shared/ui/avatar";
import { TooltipProvider } from "@/shared/ui/tooltip";

import type {
  SidebarMode,
  SidebarPanelId,
} from "../../store/sidebar-preferences";
import { CampusRail } from "./campus-rail";
import { CampusSidebar } from "./campus-sidebar";
import { railPanelItems } from "./rail-items";
import { SidebarCollapseButton } from "./sidebar-collapse-button";
import { SidebarComingSoonPanel } from "./sidebar-coming-soon-panel";

type CampusShellProps = Readonly<{
  AccountMenu?: ComponentType<{ children: ReactNode }>;
  administrationPanel?: ReactNode;
  OverviewPanel: ComponentType<{ collapseButton: ReactNode }>;
  children: ReactNode;
  cohortId: string;
  initialSidebarMode?: SidebarMode;
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
  OverviewPanel,
  children,
  cohortId,
  initialSidebarMode,
}: CampusShellProps) {
  const avatar = <RailAvatar />;

  return (
    <TooltipProvider>
      <main
        data-surface-role="background"
        className="bg-background text-foreground flex h-dvh gap-1.5 p-1.5"
      >
        <CampusRail
          account={AccountMenu ? <AccountMenu>{avatar}</AccountMenu> : avatar}
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
        {children}
      </main>
    </TooltipProvider>
  );
}
