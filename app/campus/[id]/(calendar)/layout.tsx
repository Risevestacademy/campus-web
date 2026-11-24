import { AdminSidebar } from "@/features/admin";
import {
  isSystemAdministrator,
  LogOutAction,
  requireRouteAccess,
  SessionUnavailable,
} from "@/features/auth";
import { CalendarPanel } from "@/features/calendar";
import {
  CampusShell,
  PresenceDock,
  PresenceSessionGate,
  SidebarCollapseButton,
} from "@/features/campus";
import { FeedbackPopup } from "@/features/feedback";
import { OwnProfileAction } from "@/features/profile";

import { OverviewPanelWithProfiles } from "../campus-overview-panel";
import { cohortContextOf } from "../cohort-context";
import { requireCohortId } from "../require-cohort-id";

// The calendar sits in the shell like the administration pages do: its panel
// in the sidebar and the week in the main area, with no map or meeting behind.
export default async function CalendarLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const id = await requireCohortId(params);
  const access = await requireRouteAccess({ kind: "cohort", cohortId: id });

  if (access.kind === "unavailable") {
    return <SessionUnavailable retryHref={access.retryHref} />;
  }

  const viewer = {
    id: access.session.user.id,
    displayName: access.session.user.displayName,
    avatarUrl: access.session.user.avatarUrl,
  };

  return (
    <PresenceSessionGate cohortId={id}>
      <CampusShell
        administrationPanel={
          isSystemAdministrator(access.session.user.systemRole) ? (
            <AdminSidebar
              cohortId={id}
              collapseButton={<SidebarCollapseButton />}
            />
          ) : undefined
        }
        CalendarPanel={CalendarPanel}
        FeedbackPopup={FeedbackPopup}
        LogOutAction={LogOutAction}
        OwnProfileAction={OwnProfileAction}
        OverviewPanel={OverviewPanelWithProfiles}
        cohort={cohortContextOf(access.session, id)}
        cohortId={id}
        initialPanel="calendar"
        initialSidebarMode="campus"
        viewer={viewer}
      >
        <div className="bg-shell-panel border-shell-line min-w-0 flex-1 overflow-y-auto rounded-xl border">
          {children}
        </div>
        <PresenceDock cohortId={id} viewer={viewer} />
      </CampusShell>
    </PresenceSessionGate>
  );
}
