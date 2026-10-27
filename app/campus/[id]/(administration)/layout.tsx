import { AdminSidebar } from "@/features/admin";
import {
  AccountMenu,
  requireRouteAccess,
  SessionUnavailable,
} from "@/features/auth";
import {
  CampusShell,
  PresenceDock,
  PresenceSessionGate,
  SidebarCollapseButton,
} from "@/features/campus";
import { FeedbackPopup } from "@/features/feedback";
import { CampusOverviewPanel } from "@/features/roster";

import { requireCohortId } from "../require-cohort-id";

export default async function AdministrationLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const id = await requireCohortId(params);
  const access = await requireRouteAccess({ kind: "system-admin" });

  if (access.kind === "unavailable") {
    return <SessionUnavailable retryHref={access.retryHref} />;
  }

  const userName = access.session.user.displayName;

  return (
    <PresenceSessionGate cohortId={id}>
      <CampusShell
        AccountMenu={AccountMenu}
        administrationPanel={
          <AdminSidebar
            cohortId={id}
            collapseButton={<SidebarCollapseButton />}
          />
        }
        FeedbackPopup={FeedbackPopup}
        OverviewPanel={CampusOverviewPanel}
        cohortId={id}
        initialSidebarMode="admin"
        viewer={{ id: access.session.user.id, displayName: userName }}
      >
        <div className="min-w-0 flex-1 overflow-y-auto rounded-xl border bg-[#F7F7F7] dark:border-[#2B3B5F] dark:bg-[#1F2940]">
          {children}
        </div>
        <PresenceDock cohortId={id} userName={userName} />
      </CampusShell>
    </PresenceSessionGate>
  );
}
