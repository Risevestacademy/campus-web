import { CohortGate } from "@/features/auth";
import { CampusMediaSessionProvider } from "@/features/campus";

export default async function CampusLayout({
  children,
  params,
}: Readonly<{ children: React.ReactNode; params: Promise<{ id: string }> }>) {
  const { id } = await params;

  return (
    <CohortGate cohortId={id}>
      <CampusMediaSessionProvider>{children}</CampusMediaSessionProvider>
    </CohortGate>
  );
}
