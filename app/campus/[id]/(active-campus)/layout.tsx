import { AdminSidebar } from "@/features/admin";
import {
  AccountMenu,
  isSystemAdministrator,
  logsOutFromRail,
  requireRouteAccess,
  SessionUnavailable,
} from "@/features/auth";
import {
  ActiveCampus,
  type ActiveCampusViewModel,
  CampusShell,
  PresenceSessionGate,
  SidebarCollapseButton,
} from "@/features/campus";
import { CampusZoomControls } from "@/features/campus-world";
import { FeedbackPopup } from "@/features/feedback";
import { CampusOverviewPanel } from "@/features/roster";

import { requireCohortId } from "../require-cohort-id";

const PLACEHOLDER_ACTIVE_CAMPUS_VIEW_MODEL = {
  meeting: {
    localParticipantId: "participant-a",
    participants: [
      { id: "participant-a", initials: "A", name: "Participant A" },
      { id: "participant-j", initials: "J", name: "Participant J" },
    ],
    remainingParticipantCount: 2,
    title: "Title for meeting",
  },
  viewer: {
    initials: "AJ",
    presenceStatus: "active",
  },
} satisfies ActiveCampusViewModel;

export default async function ActiveCampusLayout({
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

  // Admins and members of several cohorts log out from the /campus chooser;
  // the rail offers it only to members who never see that page.
  const logsOutHere = logsOutFromRail(access.session);
  const isAdministrator = isSystemAdministrator(access.session.user.systemRole);

  return (
    <PresenceSessionGate cohortId={id}>
      <CampusShell
        AccountMenu={logsOutHere ? AccountMenu : undefined}
        administrationPanel={
          isAdministrator ? (
            <AdminSidebar
              cohortId={id}
              collapseButton={<SidebarCollapseButton />}
            />
          ) : undefined
        }
        FeedbackPopup={FeedbackPopup}
        OverviewPanel={CampusOverviewPanel}
        cohortId={id}
        userId={access.session.user.id}
        userName={access.session.user.displayName}
      >
        <ActiveCampus
          viewModel={PLACEHOLDER_ACTIVE_CAMPUS_VIEW_MODEL}
          zoomControls={<CampusZoomControls />}
        >
          {children}
        </ActiveCampus>
      </CampusShell>
    </PresenceSessionGate>
  );
}
