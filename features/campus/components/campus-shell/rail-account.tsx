"use client";

import { SparkleIcon } from "@phosphor-icons/react/dist/ssr/Sparkle";
import { UserIcon } from "@phosphor-icons/react/dist/ssr/User";
import { cn } from "cn";
import { type ComponentType, type ReactNode, useState } from "react";

import { avatarToneOf, initialOf } from "@/shared/lib/avatar";
import { Avatar, AvatarFallback, AvatarImage } from "@/shared/ui/avatar";
import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTitle,
  PopoverTrigger,
} from "@/shared/ui/popover";
import { Separator } from "@/shared/ui/separator";

import { useStatusChoice } from "../../hooks/use-status-choice";
import { STATUS_LABELS } from "../status-appearance";
import { StatusTray } from "../status-tray";
import type { CampusViewer } from "./feedback-layer";

export type LogOutActionComponent = ComponentType<{
  children: (action: { logOut: () => void; isPending: boolean }) => ReactNode;
}>;

type ProfileSection = "profile" | "character";

type OwnProfileControls = {
  summary:
    | {
        avatarUrl: string | null;
        displayName: string | null;
        email: string;
        place: string | null;
      }
    | undefined;
  openEditor: (section: ProfileSection) => void;
};

// The member's profile and its editor, for the account menu to draw: routes
// pass this in, because campus may not import the profile feature.
export type OwnProfileActionComponent = ComponentType<{
  children: (controls: OwnProfileControls) => ReactNode;
  cohortId: string;
}>;

type LogOut = { logOut: () => void; isPending: boolean };

type RailAccountProps = Readonly<{
  cohortId: string;
  LogOutAction?: LogOutActionComponent;
  OwnProfileAction?: OwnProfileActionComponent;
  viewer?: CampusViewer;
}>;

// The rail's avatar opens the member's account: their status, their profile
// and logging out, the way it is drawn in the account menu design.
export function RailAccount({
  cohortId,
  LogOutAction,
  OwnProfileAction,
  viewer,
}: RailAccountProps) {
  function menu(profile?: OwnProfileControls) {
    return LogOutAction ? (
      <LogOutAction>
        {(logOut) => (
          <AccountMenu
            cohortId={cohortId}
            logOut={logOut}
            profile={profile}
            viewer={viewer}
          />
        )}
      </LogOutAction>
    ) : (
      <AccountMenu cohortId={cohortId} profile={profile} viewer={viewer} />
    );
  }

  return OwnProfileAction ? (
    <OwnProfileAction cohortId={cohortId}>{menu}</OwnProfileAction>
  ) : (
    menu()
  );
}

function AccountMenu({
  cohortId,
  logOut,
  profile,
  viewer,
}: {
  cohortId: string;
  logOut?: LogOut;
  profile?: OwnProfileControls;
  viewer?: CampusViewer;
}) {
  const [open, setOpen] = useState(false);
  const [isAskingToLogOut, setIsAskingToLogOut] = useState(false);
  const choice = useStatusChoice(cohortId);
  const name =
    profile?.summary?.displayName ?? viewer?.displayName ?? "Campus member";
  const initial = initialOf(
    profile?.summary?.displayName ?? viewer?.displayName,
  );
  const tone = avatarToneOf(viewer?.id ?? "", "lemon");
  const photo = profile?.summary?.avatarUrl;
  const statusLabel = choice.timeLeft
    ? `${STATUS_LABELS[choice.status]} · ${choice.timeLeft} left`
    : STATUS_LABELS[choice.status];

  function openEditor(section: ProfileSection) {
    setOpen(false);
    profile?.openEditor(section);
  }

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          aria-label={`Your account: ${statusLabel}`}
          className="focus-visible:ring-primary-foreground ring-offset-primary aria-expanded:ring-primary-foreground rounded-full outline-none focus-visible:ring-2 focus-visible:ring-offset-2 aria-expanded:ring-2 aria-expanded:ring-offset-2"
        >
          <Avatar size="lg" className="dark:after:border-transparent">
            {photo ? <AvatarImage src={photo} alt="" /> : null}
            <AvatarFallback className={cn("font-medium", tone)}>
              {initial}
            </AvatarFallback>
          </Avatar>
        </PopoverTrigger>
        <PopoverContent
          side="right"
          align="end"
          sideOffset={12}
          className="flex w-80 flex-col gap-3.5 p-4.5"
        >
          <div className="flex items-center gap-3">
            <Avatar className="size-13 dark:after:border-transparent">
              {photo ? <AvatarImage src={photo} alt="" /> : null}
              <AvatarFallback className={cn("text-xl font-semibold", tone)}>
                {initial}
              </AvatarFallback>
            </Avatar>
            <div className="flex min-w-0 flex-col gap-0.5">
              <PopoverTitle className="font-display truncate text-lg font-bold">
                {name}
              </PopoverTitle>
              {profile?.summary?.place ? (
                <p className="text-foreground-secondary truncate text-[0.8125rem]">
                  {profile.summary.place}
                </p>
              ) : null}
              <p className="text-foreground-secondary text-[0.8125rem]">
                {statusLabel}
              </p>
            </div>
          </div>

          <Separator />
          <StatusTray
            canChoose={choice.canChoose}
            durationId={choice.durationId}
            onDurationChange={choice.chooseDuration}
            onStatusChange={choice.chooseStatus}
            status={choice.status}
            timeLeft={choice.timeLeft}
            variant="menu"
          />

          {profile ? (
            <>
              <Separator />
              <div className="flex flex-col">
                <MenuAction onClick={() => openEditor("profile")}>
                  <UserIcon aria-hidden />
                  Edit profile
                </MenuAction>
                <MenuAction onClick={() => openEditor("character")}>
                  <SparkleIcon aria-hidden />
                  Change character
                </MenuAction>
              </div>
            </>
          ) : null}

          {profile?.summary || logOut ? (
            <>
              <Separator />
              <div className="flex items-center justify-between gap-2">
                <span className="text-foreground-secondary truncate text-xs">
                  {profile?.summary?.email}
                </span>
                {logOut ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={logOut.isPending}
                    onClick={() => {
                      setOpen(false);
                      setIsAskingToLogOut(true);
                    }}
                    className="text-destructive hover:text-destructive shrink-0 px-2 font-semibold"
                  >
                    {logOut.isPending ? "Logging out…" : "Log out"}
                  </Button>
                ) : null}
              </div>
            </>
          ) : null}
        </PopoverContent>
      </Popover>
      {logOut ? (
        <LogOutPrompt
          isAsking={isAskingToLogOut}
          logOut={logOut}
          onAskingChange={setIsAskingToLogOut}
        />
      ) : null}
    </>
  );
}

function MenuAction({
  children,
  onClick,
}: {
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      onClick={onClick}
      className="h-10 justify-start gap-3 px-1.5 font-normal [&_svg]:size-4.5"
    >
      {children}
    </Button>
  );
}

// Logging out ends the session everywhere, so the menu asks first. The prompt
// closes on confirming: success leaves the page, and a failure explains itself
// in a toast that the open prompt would cover.
function LogOutPrompt({
  isAsking,
  logOut: { logOut, isPending },
  onAskingChange,
}: {
  isAsking: boolean;
  logOut: LogOut;
  onAskingChange: (isAsking: boolean) => void;
}) {
  function confirm() {
    if (!isAsking || isPending) return;
    onAskingChange(false);
    logOut();
  }

  return (
    <Dialog open={isAsking} onOpenChange={onAskingChange}>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Log out of Campus?</DialogTitle>
          <DialogDescription>
            You will leave your room and need to sign in again to come back.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="sm:justify-center">
          <DialogClose render={<Button variant="outline" />}>
            Stay signed in
          </DialogClose>
          <Button
            type="button"
            variant="destructive"
            disabled={!isAsking || isPending}
            onClick={confirm}
          >
            Log out
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
