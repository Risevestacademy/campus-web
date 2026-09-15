export function FoundationsOverview() {
  return (
    <main className="mx-auto flex min-h-96 max-w-3xl items-center px-6 py-16">
      <section
        aria-labelledby="foundations-title"
        className="border-foreground/20 space-y-4 border-l pl-6"
      >
        <p className="text-foreground/60 text-xs font-semibold tracking-[0.18em] uppercase">
          Campus design system
        </p>
        <h1
          id="foundations-title"
          className="text-3xl font-semibold tracking-tight"
        >
          Design system foundations
        </h1>
        <p className="text-foreground/70 max-w-2xl text-base leading-7">
          Colors, typography, spacing, radius, shadows, icons, and motion are
          awaiting an approved design source.
        </p>
      </section>
    </main>
  );
}
