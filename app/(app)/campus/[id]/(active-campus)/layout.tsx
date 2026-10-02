import type { ReactNode } from "react";

import {
  CampusControlBar,
  MeetingHeader,
  MeetingViewControls,
} from "@/features/campus";
import {
  CampusRail,
  CampusSidebar,
  closeSidebarForGridView,
  getServerSidebarOpenSnapshot,
  getSidebarOpenSnapshot,
  railPanelItems,
  SidebarCollapseButton,
  SidebarComingSoonPanel,
  subscribeToShell,
  toggleSidebar,
} from "@/features/campus-shell";
import { CampusOverviewPanel } from "@/features/roster";

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
) as Record<Exclude<(typeof railPanelItems)[number]["id"], "map">, ReactNode>;

export default function ActiveCampusLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main
      data-surface-role="background"
      className="bg-background text-foreground flex h-dvh gap-1.5 p-1.5"
    >
      <CampusRail />
      <CampusSidebar
        panels={{
          ...comingSoonPanels,
          map: <CampusOverviewPanel collapseButton={collapseButton} />,
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
                  onOpenSidebar={toggleSidebar}
                />
              </div>
              <MeetingViewControls
                participants={meetingParticipants}
                onViewChange={closeSidebarForGridView}
                subscribeToSidebarOpen={subscribeToShell}
                getSidebarOpenSnapshot={getSidebarOpenSnapshot}
                getServerSidebarOpenSnapshot={getServerSidebarOpenSnapshot}
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
