"use client";

import type { Route } from "next";
import { useRouter } from "next/navigation";

import { campusHref } from "@/core/navigation";
import { movementFor } from "@/core/realtime";
import { useMountEffect } from "@/shared/lib/use-mount-effect";

// Walks the member into a space as soon as world has placed them, for a link
// that named one. A reload must not walk again, so the request leaves the URL
// once world takes it. A closed socket keeps it until the next snapshot.
export function WalkOnArrival({
  cohortId,
  spaceKey,
}: {
  cohortId: string;
  spaceKey: string;
}) {
  const router = useRouter();

  useMountEffect(() => {
    const movement = movementFor(cohortId);
    let unsubscribe: (() => void) | undefined;

    function walk(): boolean {
      if (!movement.sendGoToSpace(spaceKey)) return false;

      unsubscribe?.();
      router.replace(campusHref(cohortId) as Route);
      return true;
    }

    if (!walk()) {
      unsubscribe = movement.subscribe((message) => {
        if (message.type === "snapshot") walk();
      });
    }

    return () => unsubscribe?.();
  });

  return null;
}
