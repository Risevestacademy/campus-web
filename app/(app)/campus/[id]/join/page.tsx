import { cn } from "cn";
import Link from "next/link";

import { CampusShellGate } from "@/features/auth";
import { VisualsDisplay } from "@/features/campus";
import { buttonVariants } from "@/shared/ui/button";

export default async function JoinPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <CampusShellGate>
      <main className="grid h-dvh content-center gap-6">
        <VisualsDisplay />

        <Link
          href={`/campus/${id}`}
          className={cn(buttonVariants({ size: "lg" }), "mx-auto min-w-40")}
        >
          Join
        </Link>
      </main>
    </CampusShellGate>
  );
}
