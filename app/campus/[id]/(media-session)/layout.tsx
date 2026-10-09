import { CohortGate } from "@/features/auth";
import { CampusMediaSessionProvider } from "@/features/campus";

// One session from the Join Gate into Active Campus keeps the devices chosen
// on pre-join; a separate session per page would release them on "Join".
export default async function MediaSessionLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <CohortGate cohortId={id}>
      <CampusMediaSessionProvider>{children}</CampusMediaSessionProvider>
    </CohortGate>
  );
}
