"use client";
import { DotsThreeVerticalIcon } from "@phosphor-icons/react/dist/ssr/DotsThreeVertical";
import { useState } from "react";

import { Button } from "@/shared/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";

import type { TrackSummary } from "../types/track.types";
import { DeleteTrackDialog } from "./delete-track-dialog";
import { EditTrackDialog } from "./edit-track-dialog";
export function TrackAdministrationActions({ track }: { track: TrackSummary }) {
  const [action, setAction] = useState<"edit" | "delete">();
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={`Manage ${track.name}`}
            />
          }
        >
          <DotsThreeVerticalIcon aria-hidden="true" />
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          aria-label={`${track.name} administration`}
        >
          <DropdownMenuItem onClick={() => setAction("edit")}>
            Edit
          </DropdownMenuItem>
          <DropdownMenuItem
            variant="destructive"
            onClick={() => setAction("delete")}
          >
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <EditTrackDialog
        track={track}
        open={action === "edit"}
        onOpenChange={(open) => setAction(open ? "edit" : undefined)}
      />
      <DeleteTrackDialog
        track={track}
        open={action === "delete"}
        onOpenChange={(open) => setAction(open ? "delete" : undefined)}
      />
    </>
  );
}
