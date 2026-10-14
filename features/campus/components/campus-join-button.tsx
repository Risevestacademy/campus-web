"use client";

import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/shared/ui/button";

import { useAdmission } from "../services/presence-session/presence-session-provider";

export function CampusJoinButton({
  destination,
}: Readonly<{ destination: string }>) {
  const router = useRouter();
  const grantEntry = useAdmission((state) => state.grantEntry);
  const [isJoining, setIsJoining] = useState(false);

  function joinCampus() {
    if (isJoining) return;

    setIsJoining(true);
    grantEntry(destination);
    router.push(destination as Route);
  }

  return (
    <Button
      className="mx-auto min-w-40"
      disabled={isJoining}
      onClick={joinCampus}
      size="lg"
      type="button"
    >
      {isJoining ? "Joining…" : "Join"}
    </Button>
  );
}
