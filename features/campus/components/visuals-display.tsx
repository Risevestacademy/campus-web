import { MediaControls } from "./media-controls";

export function VisualsDisplay() {
  return (
    <section className="relative flex flex-col items-center justify-center">
      <figure className="bg-surface aspect-4/3 w-full max-w-160"></figure>

      <div className="absolute bottom-3">
        <MediaControls />
      </div>
    </section>
  );
}
