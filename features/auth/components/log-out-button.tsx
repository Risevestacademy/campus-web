"use client";

import { SignOutIcon } from "@phosphor-icons/react/dist/ssr/SignOut";
import type { ComponentProps } from "react";

import { Button } from "@/shared/ui/button";

import { useLogOut } from "../hooks/use-log-out";

type LogOutButtonProps = Pick<
  ComponentProps<typeof Button>,
  "className" | "size" | "variant"
>;

// A standalone way to log out for places that have no account menu. The
// session ends the same way as from the menu.
export function LogOutButton({
  variant = "outline",
  size,
  className,
}: LogOutButtonProps) {
  const { logOut, isPending } = useLogOut();

  return (
    <Button
      variant={variant}
      size={size}
      className={className}
      disabled={isPending}
      onClick={logOut}
    >
      <SignOutIcon aria-hidden data-icon="inline-start" />
      {isPending ? "Logging out…" : "Log out"}
    </Button>
  );
}
