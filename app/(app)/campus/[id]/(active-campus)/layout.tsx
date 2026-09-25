import Link from "next/link";

export default function ActiveCampusLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="flex h-dvh">
      <aside id="left-actions" className="px-1.5 py-3">
        <figure className="bg-surface aspect-square size-12 rounded-xl"></figure>
      </aside>

      <div className="flex flex-1 p-1.5 pl-0">
        <div className="bg-surface/50 grid flex-1 grid-rows-[auto_1fr_auto] rounded-xl">
          <div className="relative">
            <aside
              id="top-actions"
              className="absolute inset-x-0 top-0 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-start gap-1.5 p-1.5"
            >
              {/* top actions */}
              <div className="flex h-fit items-center gap-3">
                <button className="bg-surface border-surface-elevated size-10 rounded-xl border"></button>

                <div className="flex items-center gap-1.5">
                  <div className="flex">
                    <figure className="bg-surface border-surface-elevated size-8 rounded-full border"></figure>
                    <figure className="bg-surface border-surface-elevated -ml-2 size-8 rounded-full border"></figure>
                  </div>
                  <h2 className="text-sm font-medium">Title for meeting</h2>
                </div>

                <button className="bg-surface border-surface-elevated size-10 rounded-xl border"></button>
              </div>

              <div className="bg-background mx-auto flex w-fit flex-col rounded-[1.125rem] p-1.5">
                <div className="flex items-center justify-center gap-1.5">
                  <figure className="bg-surface aspect-video w-60 rounded-xl"></figure>
                  <figure className="bg-surface aspect-video w-60 rounded-xl"></figure>
                </div>
                <p className="px-2 pt-1.5 pb-1 text-center text-sm">
                  Description for meeting
                </p>
              </div>

              <div className="mr-12 justify-self-end">
                <button className="bg-surface border-surface-elevated size-10 rounded-xl border"></button>
              </div>
            </aside>
          </div>

          {children}

          <div className="relative">
            <aside
              id="bottom-actions"
              className="absolute inset-x-0 bottom-0 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center p-1.5 px-3"
            >
              {/* bottom actions */}
              <div className="bg-background col-start-2 flex items-center gap-1.5 rounded-[1.125rem] p-1.5 px-3">
                <button className="bg-surface size-10 rounded-xl"></button>
                <div className="bg-surface mx-1.5 h-6 w-px"></div>

                <button className="bg-surface size-10 w-12 rounded-xl"></button>
                <button className="bg-surface size-10 w-12 rounded-xl"></button>
                <button className="bg-surface size-10 rounded-xl"></button>
                <button className="bg-surface size-10 rounded-xl"></button>
                <button className="bg-surface size-10 rounded-xl"></button>

                <div className="bg-surface mx-1.5 h-6 w-px"></div>
                <Link
                  href={"/campus"}
                  className="bg-surface size-10 rounded-xl"
                ></Link>
              </div>

              <div className="ml-auto flex gap-3">
                <button className="bg-surface border-surface-elevated size-10 rounded-xl border"></button>
                <button className="bg-surface border-surface-elevated size-10 rounded-xl border"></button>
              </div>
            </aside>
          </div>
        </div>
      </div>
    </main>
  );
}
