import type { ReactNode } from "react";

import {
  AccountMenu,
  logsOutFromRail,
  requireRouteAccess,
} from "@/features/auth";
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
  RailAvatar,
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

// Admins and members of several cohorts log out from the /campus chooser;
// the rail offers it only to members who never see that page.
async function railAccount(cohortId: string): Promise<ReactNode> {
  const access = await requireRouteAccess({ kind: "cohort", cohortId });
  const avatar = <RailAvatar />;

  return access.kind === "allow" && logsOutFromRail(access.session) ? (
    <AccountMenu>{avatar}</AccountMenu>
  ) : (
    avatar
  );
}

export default async function ActiveCampusLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const account = await railAccount(id);

  return (
    <main
      data-surface-role="background"
      className="bg-background text-foreground flex h-dvh gap-1.5 p-1.5"
    >
      <CampusRail account={account} />
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
                localParticipantId="participant-a"
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
