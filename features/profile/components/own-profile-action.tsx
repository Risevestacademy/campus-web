"use client";

import { type ReactNode, useState } from "react";

import { useOwnProfile } from "../hooks/use-own-profile";
import { summaryOf } from "../schemas/own-profile.schema";
import type { OwnProfileSummary, ProfileSection } from "../types";
import { ProfileDialog } from "./profile-dialog";

export type OwnProfileControls = {
  // Undefined until the profile is read, and when it cannot be.
  summary: OwnProfileSummary | undefined;
  openEditor: (section: ProfileSection) => void;
};

// The member's own profile for a control another feature draws: routes pass
// this in, the feature supplies the look, and the editor opens over the page.
// It stays mounted with the control, so closing a menu leaves the editor open.
export function OwnProfileAction({
  children,
  cohortId,
}: {
  children: (controls: OwnProfileControls) => ReactNode;
  cohortId: string;
}) {
  const read = useOwnProfile();
  const [open, setOpen] = useState(false);
  const [section, setSection] = useState<ProfileSection>("profile");

  return (
    <>
      {children({
        summary:
          read?.kind === "loaded"
            ? summaryOf(read.profile, cohortId)
            : undefined,
        openEditor: (next) => {
          setSection(next);
          setOpen(true);
        },
      })}
      <ProfileDialog
        cohortId={cohortId}
        onOpenChange={setOpen}
        onSectionChange={setSection}
        open={open}
        read={read}
        section={section}
      />
    </>
  );
}
