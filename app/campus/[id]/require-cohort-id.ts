import { notFound } from "next/navigation";

import { parseCohortId } from "@/core/navigation";

export async function requireCohortId(
  params: Promise<{ id: unknown }>,
): Promise<string> {
  const cohortId = parseCohortId((await params).id);
  if (!cohortId) notFound();
  return cohortId;
}
