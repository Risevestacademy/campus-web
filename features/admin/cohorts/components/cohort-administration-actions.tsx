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

import type { CohortSummary } from "../types/cohort.types";
import { DeleteCohortDialog } from "./delete-cohort-dialog";
import { EditCohortDialog } from "./edit-cohort-dialog";

type Action = "edit" | "delete";

export function CohortAdministrationActions({
  cohort,
}: {
  cohort: CohortSummary;
}) {
  const [action, setAction] = useState<Action>();

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={`Manage ${cohort.name}`}
            />
          }
        >
          <DotsThreeVerticalIcon aria-hidden="true" />
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          aria-label={`${cohort.name} administration`}
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
      <EditCohortDialog
        cohort={cohort}
        open={action === "edit"}
        onOpenChange={(open) => setAction(open ? "edit" : undefined)}
      />
      <DeleteCohortDialog
        cohort={cohort}
        open={action === "delete"}
        onOpenChange={(open) => setAction(open ? "delete" : undefined)}
      />
    </>
  );
}
