import type { Icon } from "@phosphor-icons/react";
import { ChatCircleDotsIcon } from "@phosphor-icons/react/dist/ssr/ChatCircleDots";
import { ChecksIcon } from "@phosphor-icons/react/dist/ssr/Checks";
import { UsersIcon } from "@phosphor-icons/react/dist/ssr/Users";
import { VideoCameraIcon } from "@phosphor-icons/react/dist/ssr/VideoCamera";

import type { OverviewStat, OverviewStatId } from "./overview-data";

const STAT_ICONS: Readonly<Record<OverviewStatId, Icon>> = {
  online: UsersIcon,
  live: VideoCameraIcon,
  attendance: ChecksIcon,
  review: ChatCircleDotsIcon,
};

export function OverviewStatCards({
  stats,
}: {
  stats: readonly OverviewStat[];
}) {
  return (
    <ul className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {stats.map((stat) => {
        const StatIcon = STAT_ICONS[stat.id];

        return (
          <li
            key={stat.id}
            className="border-border grid content-start gap-3 rounded-2xl border p-5 dark:border-[#2B3B5F] dark:bg-[#2B3B5F]"
          >
            <p className="text-foreground-secondary flex items-center gap-2 text-sm">
              <StatIcon
                aria-hidden
                size={18}
                className="text-primary dark:text-cobalt-300"
              />
              {stat.label}
            </p>
            <p className="font-display text-4xl font-semibold">{stat.value}</p>
            <p className="text-foreground-secondary text-sm">{stat.caption}</p>
          </li>
        );
      })}
    </ul>
  );
}
