"use client";

import { LinkIcon } from "@phosphor-icons/react/dist/ssr/Link";
import { useId } from "react";

import { Button } from "@/shared/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/shared/ui/dialog";

import { useOwnSpace } from "../hooks/use-own-space";
import type { RoomLinkAccess } from "../services/room-link-access";
import { NewRoomLinkForm } from "./new-room-link-dialog";

// "New room link", for staff. An admin may choose any space. A professor or
// mentor makes one for the space they stand in, so it is not offered until
// World has told the web app which space that is.
export function NewRoomLinkButton({
  access,
  cohortId,
}: Readonly<{
  access: Exclude<RoomLinkAccess, "none">;
  cohortId: string;
}>) {
  const own = useOwnSpace(cohortId);
  const hintId = useId();
  const unavailable = access === "own-space" && own === null;

  return (
    <div className="grid gap-1.5">
      <Dialog>
        <DialogTrigger
          disabled={unavailable}
          aria-describedby={unavailable ? hintId : undefined}
          render={<Button variant="outline" size="sm" className="w-full" />}
        >
          <LinkIcon aria-hidden data-icon="inline-start" />
          New room link
        </DialogTrigger>
        <DialogContent>
          <NewRoomLinkForm
            cohortId={cohortId}
            space={
              access === "any-space"
                ? { kind: "any" }
                : { kind: "own", space: own ?? { id: "", name: "" } }
            }
          />
        </DialogContent>
      </Dialog>
      {unavailable ? (
        <p id={hintId} className="text-foreground-secondary text-xs">
          Walk into a space to make a link for it.
        </p>
      ) : null}
    </div>
  );
}
