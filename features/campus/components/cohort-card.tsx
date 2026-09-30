import Link from "next/link";

export function CohortCard({ cohort }: { cohort: { id: ID } }) {
  return (
    <Link href={`/campus/${cohort.id}/join`} className="group w-fit">
      <figure className="bg-surface ring-border mb-2 block aspect-video w-80 rounded-2xl ring"></figure>
      <h3 className="line-clamp-1 pl-2 font-medium group-hover:underline">
        Cohort {cohort.id}
      </h3>
    </Link>
  );
}
