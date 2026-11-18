import type { Icon } from "@phosphor-icons/react";
import type { ReactNode } from "react";

export function SidebarComingSoonPanel({
  title,
  Icon,
  collapseButton,
}: {
  title: string;
  Icon: Icon;
  collapseButton: ReactNode;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center justify-between gap-2 p-4">
        <h2 className="text-foreground text-xl font-semibold">{title}</h2>
        {collapseButton}
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
        <div className="bg-surface text-icon-muted grid size-12 place-items-center rounded-xl">
          <Icon aria-hidden size={22} weight="regular" />
        </div>
        <p className="text-foreground-secondary text-sm">Coming soon.</p>
      </div>
    </div>
  );
}
