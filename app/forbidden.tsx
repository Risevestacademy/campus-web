import { cn } from "cn";
import Link from "next/link";

import { buttonVariants } from "@/shared/ui/button";

export default function Forbidden() {
  return (
    <main className="grid h-dvh content-center justify-items-center gap-6 px-6 text-center">
      <div className="grid max-w-md gap-2">
        <h1 className="font-display text-2xl font-bold">
          You don&apos;t have access to this page
        </h1>
        <p className="text-foreground-secondary">
          Your account can&apos;t open this part of Campus. If you think that is
          a mistake, contact your cohort lead.
        </p>
      </div>
      <Link href="/campus" className={cn(buttonVariants({ size: "lg" }))}>
        Back to Campus
      </Link>
    </main>
  );
}
