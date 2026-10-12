import { AdminSidebar } from "@/features/admin";
import {
  AccountMenu,
  requireRouteAccess,
  SessionUnavailable,
} from "@/features/auth";
import { CampusShell, SidebarCollapseButton } from "@/features/campus";
import { CampusOverviewPanel } from "@/features/roster";

export default async function AdministrationLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const [access, { id }] = await Promise.all([
    requireRouteAccess({ kind: "system-admin" }),
    params,
  ]);

  if (access.kind === "unavailable") {
    return <SessionUnavailable retryHref={access.retryHref} />;
  }

  return (
    <CampusShell
      AccountMenu={AccountMenu}
      administrationPanel={
        <AdminSidebar
          cohortId={id}
          collapseButton={<SidebarCollapseButton />}
        />
      }
      OverviewPanel={CampusOverviewPanel}
      cohortId={id}
      initialSidebarMode="admin"
    >
      <div className="min-w-0 flex-1 overflow-y-auto rounded-xl border bg-[#F7F7F7] dark:border-[#2B3B5F] dark:bg-[#1F2940]">
        {children}
      </div>
    </CampusShell>
  );
}
