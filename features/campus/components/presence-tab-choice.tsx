"use client";

import { cn } from "cn";
import Link from "next/link";
import { useState } from "react";

import { Button, buttonVariants } from "@/shared/ui/button";

const HEADINGS = {
  elsewhere: "You're in this cohort in another tab",
  "taken-over": "You joined from another tab",
} as const;

export type PresenceTabChoiceStatus = keyof typeof HEADINGS;

export function isPresenceTabChoice(
  status: string,
): status is PresenceTabChoiceStatus {
  return Object.hasOwn(HEADINGS, status);
}

export function PresenceTabChoice({
  onUseHere,
  status,
}: Readonly<{
  onUseHere: () => Promise<void>;
  status: PresenceTabChoiceStatus;
}>) {
  const [isMoving, setIsMoving] = useState(false);

  function moveHere() {
    if (isMoving) return;

    setIsMoving(true);
    void onUseHere();
  }

  return (
    <main className="grid h-dvh content-center justify-items-center gap-6 px-6 text-center">
      <div className="grid max-w-md gap-2">
        <h1 className="font-display text-2xl font-bold">{HEADINGS[status]}</h1>
        <p className="text-foreground-secondary">
          Your call can be open in one tab at a time. Use it here to move it
          from the other tab, with your camera and microphone off.
        </p>
      </div>
      <div className="flex gap-3">
        <Button disabled={isMoving} onClick={moveHere} size="lg" type="button">
          {isMoving ? "Moving…" : "Use here"}
        </Button>
        <Link
          href="/campus"
          className={cn(buttonVariants({ size: "lg", variant: "ghost" }))}
        >
          Back to campuses
        </Link>
      </div>
    </main>
  );
}
