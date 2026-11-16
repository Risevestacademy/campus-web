import { AdminSidebar } from "@/features/admin";
import {
  isSystemAdministrator,
  LogOutAction,
  requireRouteAccess,
  SessionUnavailable,
} from "@/features/auth";
import {
  ActiveCampus,
  CampusShell,
  PresenceSessionGate,
  SidebarCollapseButton,
} from "@/features/campus";
import { CampusZoomControls } from "@/features/campus-world";
import { FeedbackPopup } from "@/features/feedback";
import { OwnProfileAction } from "@/features/profile";
import { CampusOverviewPanel } from "@/features/roster";

import { cohortContextOf } from "../cohort-context";
import { requireCohortId } from "../require-cohort-id";

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

  const isAdministrator = isSystemAdministrator(access.session.user.systemRole);
  const viewer = {
    id: access.session.user.id,
    displayName: access.session.user.displayName,
  };

  return (
    <PresenceSessionGate cohortId={id}>
      <CampusShell
        administrationPanel={
          isAdministrator ? (
            <AdminSidebar
              cohortId={id}
              collapseButton={<SidebarCollapseButton />}
            />
          ) : undefined
        }
        FeedbackPopup={FeedbackPopup}
        LogOutAction={LogOutAction}
        OwnProfileAction={OwnProfileAction}
        OverviewPanel={CampusOverviewPanel}
        cohort={cohortContextOf(access.session, id)}
        cohortId={id}
        viewer={viewer}
      >
        <ActiveCampus
          cohortId={id}
          viewer={viewer}
          zoomControls={<CampusZoomControls />}
        >
          {children}
        </ActiveCampus>
      </CampusShell>
    </PresenceSessionGate>
  );
}
