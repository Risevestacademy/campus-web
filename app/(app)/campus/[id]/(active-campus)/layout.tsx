import {
  AccountMenu,
  logsOutFromRail,
  requireRouteAccess,
} from "@/features/auth";
import { ActiveCampus } from "@/features/campus";
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
  // Admins and members of several cohorts log out from the /campus chooser;
  // the rail offers it only to members who never see that page.
  const logsOutHere =
    access.kind === "allow" && logsOutFromRail(access.session);

  return (
    <ActiveCampus
      AccountMenu={logsOutHere ? AccountMenu : undefined}
      OverviewPanel={CampusOverviewPanel}
    >
      {children}
    </ActiveCampus>
  );
}
