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
  CampusMediaSessionProvider,
  CampusShell,
  SidebarCollapseButton,
} from "@/features/campus";
import { CampusOverviewPanel } from "@/features/roster";

export default async function ActiveCampusLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const access = await requireRouteAccess({ kind: "cohort", cohortId: id });

  if (access.kind === "unavailable") {
    return <SessionUnavailable retryHref={access.retryHref} />;
  }

  // Admins and members of several cohorts log out from the /campus chooser;
  // the rail offers it only to members who never see that page.
  const logsOutHere = logsOutFromRail(access.session);
  const isAdministrator = isSystemAdministrator(access.session.user.systemRole);

  return (
    <CampusShell
      AccountMenu={logsOutHere ? AccountMenu : undefined}
      AdministrationPanel={
        isAdministrator ? (
          <AdminSidebar
            cohortId={id}
            collapseButton={<SidebarCollapseButton />}
          />
        ) : undefined
      }
      OverviewPanel={CampusOverviewPanel}
      cohortId={id}
    >
      <CampusMediaSessionProvider>
        <ActiveCampus>{children}</ActiveCampus>
      </CampusMediaSessionProvider>
    </CampusShell>
  );
}
