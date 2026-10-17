import {
  CohortGate,
  SessionRefreshProvider,
  SessionRenewal,
} from "@/features/auth";
import { PresenceSession } from "@/features/campus";

// One Presence Session per cohort spans pre-join and every cohort page, so
// changing page keeps the call; reloads and other cohorts start a new one.
export default async function CohortLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <CohortGate cohortId={id}>
      <SessionRenewal cohortId={id} />
      <SessionRefreshProvider>
        <PresenceSession cohortId={id} key={id}>
          {children}
        </PresenceSession>
      </SessionRefreshProvider>
    </CohortGate>
  );
}
