import { cn } from "cn";

import { type AdminRole, roleLabelOf } from "./role-labels";

function toneFor({ systemRole, role }: AdminRole) {
  if (systemRole !== "user") {
    return "bg-lemon-100 text-lemon-800 dark:bg-lemon-900/40 dark:text-lemon-300";
  }
  if (role === "professor" || role === "mentor") {
    return "bg-[#E9E4FB] text-[#6D3FD6] dark:bg-[#3A3366] dark:text-[#B9A8F5]";
  }
  return "text-foreground-secondary bg-[#EFFAFF] dark:bg-[#2B3B5F]";
}

export function RoleBadge({ person }: { person: AdminRole }) {
  return (
    <span
      className={cn(
        "inline-flex w-fit items-center rounded-full px-2.5 py-1 text-sm",
        toneFor(person),
      )}
    >
      {roleLabelOf(person)}
    </span>
  );
}
