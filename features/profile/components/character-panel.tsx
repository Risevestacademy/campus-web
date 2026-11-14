import { SparkleIcon } from "@phosphor-icons/react/dist/ssr/Sparkle";
import { useId } from "react";

// The characters are not drawn yet, so the tab holds their place: the
// account menu already links here, and picking one lands with the sprites.
export function CharacterPanel() {
  const headingId = useId();

  return (
    <section aria-labelledby={headingId} className="flex h-full flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h3 id={headingId} className="font-display text-2xl font-bold">
          Character
        </h3>
        <p className="text-muted-foreground text-[0.9375rem]">
          How you look walking around the map
        </p>
      </div>
      <div className="text-muted-foreground flex min-h-64 flex-1 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed text-center text-sm">
        <SparkleIcon aria-hidden className="size-6" />
        Characters are coming soon.
      </div>
    </section>
  );
}
