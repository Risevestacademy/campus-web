"use client";

import { cn } from "cn";
import Link from "next/link";
import { useState } from "react";

import { Button, buttonVariants } from "@/shared/ui/button";

const ENTERED_ELSEWHERE_HEADING = "You opened this campus somewhere else";

const HEADINGS = {
  elsewhere: "You're in this cohort in another tab",
  released: ENTERED_ELSEWHERE_HEADING,
  "taken-over": "You joined from another tab",
  "entered-elsewhere": ENTERED_ELSEWHERE_HEADING,
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
  onUseHere: () => Promise<boolean>;
  status: PresenceTabChoiceStatus;
}>) {
  const [isMoving, setIsMoving] = useState(false);

  async function moveHere() {
    if (isMoving) return;

    setIsMoving(true);
    try {
      const moved = await onUseHere();
      if (!moved) setIsMoving(false);
    } catch (error) {
      setIsMoving(false);
      throw error;
    }
  }

  return (
    <main className="grid h-dvh content-center justify-items-center gap-6 px-6 text-center">
      <div className="grid max-w-md gap-2">
        <h1 className="font-display text-2xl font-bold">{HEADINGS[status]}</h1>
        <p className="text-foreground-secondary">
          Your call can be open in one place at a time. Use it here to move it
          from the other tab or device, with your camera and microphone off.
        </p>
      </div>
      <div className="flex gap-3">
        <Button
          disabled={isMoving}
          onClick={() => void moveHere()}
          size="lg"
          type="button"
        >
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
