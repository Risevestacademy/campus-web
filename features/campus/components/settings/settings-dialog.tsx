"use client";

import { BellIcon } from "@phosphor-icons/react/dist/ssr/Bell";
import { MicrophoneIcon } from "@phosphor-icons/react/dist/ssr/Microphone";
import { ShieldCheckIcon } from "@phosphor-icons/react/dist/ssr/ShieldCheck";
import { SignOutIcon } from "@phosphor-icons/react/dist/ssr/SignOut";
import { SunIcon } from "@phosphor-icons/react/dist/ssr/Sun";
import { XIcon } from "@phosphor-icons/react/dist/ssr/X";
import { cn } from "cn";
import { useState } from "react";

import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
} from "@/shared/ui/dialog";
import { Tabs, TabsList, TabsPanel, TabsTab } from "@/shared/ui/tabs";

import {
  type LogOutActionComponent,
  LogOutConfirmDialog,
} from "../campus-shell/log-out-confirm-dialog";
import { AppearanceSettings } from "./appearance-settings";
import { AudioVideoSettings } from "./audio-video-settings";
import { PrivacySettings } from "./privacy-settings";
import { SettingsSectionHeading } from "./settings-row";

// In dark mode the dialog takes the campus shell's navy panels instead of the
// generic grey popover, by redefining the tokens everything inside reads.
const SHELL_DARK_PALETTE = [
  "dark:[--popover:var(--color-shell-panel)] dark:[--input:var(--color-shell-line)]",
  "dark:[--color-border:var(--color-shell-line)] dark:[--color-surface:var(--color-cobalt-950)]",
  "dark:[--color-surface-elevated:var(--color-cobalt-900)] dark:[--color-surface-hover:var(--color-shell-hover)]",
  "dark:ring-shell-line",
].join(" ");

function SettingsLogOut({
  logOut,
  isPending,
}: {
  logOut: () => void;
  isPending: boolean;
}) {
  const [isAsking, setIsAsking] = useState(false);

  return (
    <>
      <button
        type="button"
        disabled={isPending}
        onClick={() => setIsAsking(true)}
        className="text-error-foreground hover:bg-error-subtle focus-visible:ring-ring/50 flex min-h-11 shrink-0 items-center gap-3 rounded-lg px-3 text-sm font-medium whitespace-nowrap outline-none focus-visible:ring-3 disabled:opacity-50 [&_svg]:size-5"
      >
        <SignOutIcon aria-hidden weight="bold" />
        {isPending ? "Logging out…" : "Log out"}
      </button>
      <LogOutConfirmDialog
        open={isAsking}
        onOpenChange={setIsAsking}
        logOut={logOut}
        isPending={isPending}
      />
    </>
  );
}

export function SettingsDialog({
  open,
  onOpenChange,
  LogOutAction,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  LogOutAction?: LogOutActionComponent;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className={cn(
          "flex h-[min(700px,calc(100dvh-2rem))] flex-col gap-0 overflow-hidden p-0 sm:max-w-[880px]",
          SHELL_DARK_PALETTE,
        )}
      >
        <div className="border-border flex items-center justify-between border-b py-3 pr-4 pl-7">
          <DialogTitle className="font-display text-[22px] font-bold">
            Settings
          </DialogTitle>
          <DialogClose
            render={
              <Button
                variant="ghost"
                size="icon-lg"
                aria-label="Close settings"
              />
            }
          >
            <XIcon aria-hidden />
          </DialogClose>
        </div>

        <Tabs
          defaultValue="audio-video"
          orientation="vertical"
          className="min-h-0 flex-1 gap-0 max-sm:flex-col"
        >
          <div className="bg-surface-elevated flex shrink-0 gap-1 p-3 max-sm:overflow-x-auto sm:w-55 sm:flex-col sm:px-3 sm:py-4">
            <TabsList
              aria-label="Settings sections"
              className="max-sm:flex-row"
            >
              <TabsTab value="audio-video">
                <MicrophoneIcon aria-hidden weight="bold" />
                Audio &amp; video
              </TabsTab>
              <TabsTab value="appearance">
                <SunIcon aria-hidden weight="bold" />
                Appearance
              </TabsTab>
              <TabsTab value="notifications">
                <BellIcon aria-hidden weight="bold" />
                Notifications
              </TabsTab>
              <TabsTab value="privacy">
                <ShieldCheckIcon aria-hidden weight="bold" />
                Privacy
              </TabsTab>
            </TabsList>
            {LogOutAction ? (
              <>
                <div className="flex-1" />
                <LogOutAction>
                  {(action) => <SettingsLogOut {...action} />}
                </LogOutAction>
              </>
            ) : null}
          </div>

          <TabsPanel
            value="audio-video"
            className="min-w-0 flex-1 overflow-y-auto px-8 py-7"
          >
            <AudioVideoSettings />
          </TabsPanel>
          <TabsPanel
            value="appearance"
            className="min-w-0 flex-1 overflow-y-auto px-8 py-7"
          >
            <AppearanceSettings />
          </TabsPanel>
          {/* Nothing sends notifications yet; the tab holds their place. */}
          <TabsPanel
            value="notifications"
            className="min-w-0 flex-1 overflow-y-auto px-8 py-7"
          >
            <SettingsSectionHeading title="Notifications" />
          </TabsPanel>
          <TabsPanel
            value="privacy"
            className="min-w-0 flex-1 overflow-y-auto px-8 py-7"
          >
            <PrivacySettings />
          </TabsPanel>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
