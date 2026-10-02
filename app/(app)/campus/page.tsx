import Link from "next/link";

import { CohortCard } from "@/features/campus";

export default function CampusPage() {
  return (
    <div data-surface-role="background" className="bg-background space-y-8">
      <header className="flex h-16 items-end px-10">
        <Link href={"/"} className="flex items-center gap-3">
          <figure
            data-surface-role="surface"
            className="bg-surface ring-border size-12 rounded-xl ring"
          ></figure>
          <h1 className="text-xl font-medium">Campus by Rise</h1>
        </Link>
      </header>

      <div className="flex gap-8 px-10">
        {[1, 2].map((item) => (
          <CohortCard key={item} cohort={{ id: item }} />
        ))}
      </div>
    </div>
  );
}
