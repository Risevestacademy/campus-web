"use client";

import { MinusIcon } from "@phosphor-icons/react/dist/ssr/Minus";
import { PlusIcon } from "@phosphor-icons/react/dist/ssr/Plus";

import { keepFocus } from "@/shared/lib/keep-focus";
import { Button } from "@/shared/ui/button";
import { ButtonGroup } from "@/shared/ui/button-group";

import {
  type CampusMapDependencies,
  defaultCampusWorldDependencies,
} from "../hooks/campus-world-dependencies";

interface CampusZoomControlsProps {
  dependencies?: Pick<CampusMapDependencies, "runtime">;
}

export function CampusZoomControls({
  dependencies = defaultCampusWorldDependencies,
}: CampusZoomControlsProps) {
  const { runtime } = dependencies;

  return (
    <ButtonGroup orientation="vertical" aria-label="Zoom controls">
      <Button
        type="button"
        size="icon-sm"
        variant="outline"
        aria-label="Zoom in"
        title="Zoom in"
        className="bg-surface-elevated"
        onClick={() => runtime.zoom(1)}
        onMouseDown={keepFocus}
      >
        <PlusIcon aria-hidden />
      </Button>
      <Button
        type="button"
        size="icon-sm"
        variant="outline"
        aria-label="Zoom out"
        title="Zoom out"
        className="bg-surface-elevated"
        onClick={() => runtime.zoom(-1)}
        onMouseDown={keepFocus}
      >
        <MinusIcon aria-hidden />
      </Button>
    </ButtonGroup>
  );
}
