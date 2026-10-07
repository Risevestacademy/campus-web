import { CohortGate } from "@/features/auth";

export default async function ActiveCampusMeetingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <CohortGate cohortId={id}>
      <div className="grid place-content-center">
        <h1>ActiveCampusMeetingPage</h1>
      </div>
    </CohortGate>
  );
}
