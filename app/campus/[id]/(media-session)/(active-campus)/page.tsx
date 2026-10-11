import { CohortGate } from "@/features/auth";
import { CampusWorld } from "@/features/campus-world";

export default async function ActiveCampusPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <CohortGate cohortId={id}>
      <CampusWorld cohortId={id} />
    </CohortGate>
  );
}
