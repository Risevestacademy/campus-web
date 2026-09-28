import { CampusControlBar } from "@/features/campus";

export default function ActiveCampusLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main
      data-surface-role="background"
      className="bg-background text-foreground flex h-dvh"
    >
      <aside id="left-actions" className="px-1.5 py-3">
        <figure
          data-surface-role="surface"
          className="bg-surface aspect-square size-12 rounded-xl"
        ></figure>
      </aside>

      <div className="flex flex-1 p-1.5 pl-0">
        <div
          data-surface-role="surface"
          className="bg-surface grid flex-1 grid-rows-[auto_1fr_auto] rounded-xl"
        >
          <div className="relative">
            <aside
              id="top-actions"
              className="absolute inset-x-0 top-0 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-start gap-1.5 p-2.5"
            >
              {/* top actions */}
              <div className="flex h-fit items-center gap-3">
                <button
                  data-surface-role="surface-elevated"
                  className="bg-surface-elevated border-border size-10 rounded-xl border"
                ></button>

                <div className="flex items-center gap-1.5">
                  <div className="flex">
                    <figure className="bg-surface-elevated border-border size-8 rounded-full border"></figure>
                    <figure className="bg-surface-elevated border-border -ml-2 size-8 rounded-full border"></figure>
                  </div>
                  <h2 className="text-sm font-medium">Title for meeting</h2>
                </div>

                <button className="bg-surface-elevated border-border size-10 rounded-xl border"></button>
              </div>

              <div
                data-surface-role="background"
                className="bg-background mx-auto flex w-fit flex-col rounded-[1.125rem] p-1.5"
              >
                <div className="flex items-center justify-center gap-1.5">
                  <figure className="bg-surface aspect-video w-60 rounded-xl"></figure>
                  <figure className="bg-surface aspect-video w-60 rounded-xl"></figure>
                </div>
                <p className="px-2 pt-1.5 pb-1 text-center text-sm">
                  Description for meeting
                </p>
              </div>

              <div className="flex gap-2.5 justify-self-end">
                <button className="bg-surface-elevated border-border size-10 rounded-xl border"></button>
                <button className="bg-surface-elevated border-border size-10 rounded-xl border"></button>
              </div>
            </aside>
          </div>

          {children}

          <div className="relative">
            <aside
              id="bottom-actions"
              aria-label="Campus controls"
              data-layout-anchor="campus-controls"
              className="absolute inset-x-0 bottom-0 p-2.5"
            >
              <CampusControlBar initials="AJ" status="active" />
            </aside>
          </div>
        </div>
      </div>
    </main>
  );
}
