"use client";

import { SparkleIcon } from "@phosphor-icons/react/dist/ssr/Sparkle";
import { UserIcon } from "@phosphor-icons/react/dist/ssr/User";
import { XIcon } from "@phosphor-icons/react/dist/ssr/X";

import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/shared/ui/dialog";
import { Tabs, TabsList, TabsPanel, TabsTab } from "@/shared/ui/tabs";

import { useSaveOwnProfile } from "../hooks/use-save-own-profile";
import type { OwnProfileRead, ProfileSection } from "../types";
import { CharacterPanel } from "./character-panel";
import { ProfileForm } from "./profile-form";

const SECTIONS = ["profile", "character"] as const;

function isSection(value: unknown): value is ProfileSection {
  return SECTIONS.some((section) => section === value);
}

export function ProfileDialog({
  cohortId,
  onOpenChange,
  onSectionChange,
  open,
  read,
  section,
}: {
  cohortId: string;
  onOpenChange: (open: boolean) => void;
  onSectionChange: (section: ProfileSection) => void;
  open: boolean;
  read: OwnProfileRead | undefined;
  section: ProfileSection;
}) {
  const saving = useSaveOwnProfile({ onSaved: () => onOpenChange(false) });
  const name = read?.kind === "loaded" ? read.profile.displayName : null;

  // A save in flight keeps the dialog open, so its outcome has somewhere to
  // show; a problem left from an earlier try is cleared on the way out.
  function changeOpen(next: boolean) {
    if (!next && saving.isPending) return;
    if (!next) saving.reset();
    onOpenChange(next);
  }

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogContent
        showCloseButton={false}
        className="flex max-h-[calc(100dvh-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl"
      >
        <header className="flex items-start justify-between gap-4 border-b px-6 pt-6 pb-5 sm:px-7">
          <div className="flex flex-col gap-1">
            <DialogTitle className="font-display text-3xl font-bold">
              Profile
            </DialogTitle>
            <DialogDescription className="text-[0.9375rem]">
              How you show up on Campus{name ? ` · ${name}` : null}
            </DialogDescription>
          </div>
          <DialogClose
            disabled={saving.isPending}
            render={
              <Button
                variant="ghost"
                size="icon"
                className="bg-surface-elevated rounded-full"
              />
            }
          >
            <XIcon aria-hidden />
            <span className="sr-only">Close</span>
          </DialogClose>
        </header>
        <Tabs
          value={section}
          onValueChange={(value) => {
            if (isSection(value)) onSectionChange(value);
          }}
          orientation="vertical"
          className="min-h-0 flex-1 flex-col gap-0 sm:flex-row"
        >
          <TabsList
            aria-label="Profile sections"
            className="shrink-0 border-b p-3 data-[orientation=vertical]:flex-row sm:w-56 sm:border-r sm:border-b-0 sm:data-[orientation=vertical]:flex-col"
          >
            <TabsTab value="profile">
              <UserIcon aria-hidden />
              Profile
            </TabsTab>
            <TabsTab value="character">
              <SparkleIcon aria-hidden />
              Character
            </TabsTab>
          </TabsList>
          <TabsPanel
            value="profile"
            className="overflow-y-auto px-6 py-6 sm:px-8"
          >
            {read?.kind === "loaded" ? (
              <ProfileForm
                cohortId={cohortId}
                profile={read.profile}
                saving={saving}
              />
            ) : read ? (
              <p role="alert" className="text-sm">
                We couldn&apos;t load your profile. Close this and try again.
              </p>
            ) : (
              <p className="text-muted-foreground text-sm">
                Loading your profile…
              </p>
            )}
          </TabsPanel>
          <TabsPanel
            value="character"
            className="overflow-y-auto px-6 py-6 sm:px-8"
          >
            <CharacterPanel />
          </TabsPanel>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
