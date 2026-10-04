import type { ComponentType, ReactNode } from "react";

import type { SidebarPanelId } from "../../store/shell-preferences";
import { CampusControlBar } from "../campus-control-bar";
import { MeetingHeader } from "../meeting-header";
import { MeetingViewControls } from "../meeting-view-switch";
import { CampusRail } from "./campus-rail";
import { CampusSidebar } from "./campus-sidebar";
import { RailAvatar } from "./rail-avatar";
import { railPanelItems } from "./rail-items";
import { SidebarCollapseButton } from "./sidebar-collapse-button";
import { SidebarComingSoonPanel } from "./sidebar-coming-soon-panel";

// A Server Component on purpose: AccountMenu and OverviewPanel are component
// props, which cannot cross into a client component. The route supplies them
// because this feature may not import auth or roster.
type ActiveCampusProps = Readonly<{
  AccountMenu?: ComponentType<{ children: ReactNode }>;
  OverviewPanel: ComponentType<{ collapseButton: ReactNode }>;
  children: ReactNode;
}>;

const meetingParticipants = [
  { id: "participant-a", initials: "A", name: "Participant A" },
  { id: "participant-j", initials: "J", name: "Participant J" },
] as const;

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

export function ActiveCampus({
  AccountMenu,
  OverviewPanel,
  children,
}: ActiveCampusProps) {
  const avatar = <RailAvatar />;

  return (
    <main
      data-surface-role="background"
      className="bg-background text-foreground flex h-dvh gap-1.5 p-1.5"
    >
      <CampusRail
        account={AccountMenu ? <AccountMenu>{avatar}</AccountMenu> : avatar}
      />
      <CampusSidebar
        panels={{
          ...comingSoonPanels,
          map: <OverviewPanel collapseButton={collapseButton} />,
        }}
      />

      <div className="flex flex-1">
        <div className="bg-cobalt-500/10 grid flex-1 grid-rows-[auto_1fr_auto] rounded-xl">
          <div className="relative z-1">
            <aside
              id="top-actions"
              className="absolute inset-x-0 top-0 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-start gap-1.5 p-2.5"
            >
              <div className="relative z-30">
                <MeetingHeader
                  title="Title for meeting"
                  participants={meetingParticipants}
                  remainingParticipantCount={2}
                />
              </div>
              <MeetingViewControls
                localParticipantId="participant-a"
                participants={meetingParticipants}
              />
            </aside>
          </div>

          {children}

          <div className="relative z-1">
            <aside
              id="bottom-actions"
              aria-label="Campus controls"
              data-layout-anchor="campus-controls"
              className="absolute inset-x-0 bottom-0 p-2.5"
            >
              <CampusControlBar initials="AJ" status="active" />
            </aside>
          </div>
        </div>
      </div>
    </main>
  );
}
