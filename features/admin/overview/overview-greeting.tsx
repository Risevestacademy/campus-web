"use client";

import { useSyncExternalStore } from "react";

function subscribe(): () => void {
  return () => {};
}

function getGreeting(): string {
  const hour = new Date().getHours();

  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function getServerGreeting(): string {
  return "Welcome back";
}

export function OverviewGreeting({ firstName }: { firstName?: string }) {
  const greeting = useSyncExternalStore(
    subscribe,
    getGreeting,
    getServerGreeting,
  );

  return (
    <>
      {greeting}
      {firstName ? `, ${firstName}` : null}
    </>
  );
}
