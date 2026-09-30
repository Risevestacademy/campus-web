import { MinusIcon } from "@phosphor-icons/react/dist/ssr/Minus";
import { PlusIcon } from "@phosphor-icons/react/dist/ssr/Plus";

import { Button } from "@/shared/ui/button";
import { ButtonGroup } from "@/shared/ui/button-group";

export function ZoomControls() {
  return (
    <ButtonGroup
      orientation="vertical"
      aria-label="Zoom controls"
      className="ml-auto"
    >
      <Button
        type="button"
        size="icon-sm"
        variant="outline"
        aria-label="Zoom in"
        title="Zoom in"
        className="bg-surface-elevated"
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
      >
        <MinusIcon aria-hidden />
      </Button>
    </ButtonGroup>
  );
}
