import { CaretUpIcon } from "@phosphor-icons/react/dist/ssr/CaretUp";

import { Button } from "@/shared/ui/button";
import { ButtonGroup } from "@/shared/ui/button-group";

import { MediaToggle } from "./media-toggle";

export function VisualsDisplay() {
  return (
    <section className="relative flex flex-col items-center justify-center">
      <figure className="bg-surface aspect-4/3 w-full max-w-160"></figure>

      <div className="*:bg-surface absolute bottom-3 flex w-fit items-center gap-6">
        <ButtonGroup className="*:[&_svg:not([class*='size-'])]:size-5">
          <MediaToggle kind="video" />
          <div className="bg-border my-auto h-6 w-px"></div>
          <Button size="icon" variant="ghost" className="w-fit px-1.75">
            <CaretUpIcon className="size-4" />
          </Button>
        </ButtonGroup>

        <ButtonGroup className="*:[&_svg:not([class*='size-'])]:size-5">
          <MediaToggle kind="microphone" />
          <div className="bg-border my-auto h-6 w-px"></div>
          <Button size="icon" variant="ghost" className="w-fit px-1.75">
            <CaretUpIcon className="size-4" />
          </Button>
        </ButtonGroup>
      </div>
    </section>
  );
}
