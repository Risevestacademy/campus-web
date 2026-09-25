import Link from "next/link";

import { buttonVariants } from "@/shared/ui/button";

export default async function JoinPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <main className="grid h-dvh place-content-center">
      <h1>Join Campus {id}</h1>
      <Link href={`/campus/${id}`} className={buttonVariants()}>
        Join
      </Link>
    </main>
  );
}
