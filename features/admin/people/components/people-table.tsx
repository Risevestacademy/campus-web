import { cn } from "cn";
import Link from "next/link";

import { Avatar, AvatarFallback } from "@/shared/ui/avatar";

import { avatarTone, initialOf } from "../../avatar";
import { personName } from "../people-format";
import { personHref } from "../people-href";
import type { Person } from "../types/people.types";
import { PersonStatus } from "./person-status";
import { RoleBadge } from "./role-badge";

const HEADER_CELL = "bg-[#EFFAFF] px-4 py-3 font-medium dark:bg-[#2B3B5F]";
const BODY_CELL =
  "border-border border-b px-4 py-4 group-last/row:border-b-0 dark:border-[#2B3B5F]";

export function PeopleTable({
  cohortId,
  people,
}: {
  cohortId: string;
  people: readonly Person[];
}) {
  return (
    <div className="border-border overflow-x-auto rounded-3xl border p-3 dark:border-[#2B3B5F]">
      <table className="w-full min-w-176 border-separate border-spacing-0 text-left text-sm">
        <caption className="sr-only">People</caption>
        <thead>
          <tr className="text-foreground-secondary text-xs tracking-wider uppercase">
            <th scope="col" className={`${HEADER_CELL} rounded-l-[0.5rem]`}>
              Name
            </th>
            <th scope="col" className={HEADER_CELL}>
              Role
            </th>
            <th scope="col" className={HEADER_CELL}>
              Track
            </th>
            <th scope="col" className={`${HEADER_CELL} rounded-r-[0.5rem]`}>
              Status
            </th>
          </tr>
        </thead>
        <tbody>
          {people.map((person) => {
            const name = personName(person);

            const suspended = person.status === "suspended";

            return (
              <tr
                key={person.id}
                className={cn(
                  "group/row relative",
                  !suspended && "hover:bg-[#E9ECF6] dark:hover:bg-[#2B3B5F]",
                )}
              >
                <td className={BODY_CELL}>
                  <div className="flex items-center gap-3">
                    <Avatar size="lg">
                      <AvatarFallback className={avatarTone(person.id)}>
                        {initialOf(name)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="min-w-0">
                      {suspended ? (
                        <span className="block font-medium [overflow-wrap:anywhere]">
                          {name}
                        </span>
                      ) : (
                        // The link covers the whole row, so any cell opens it.
                        <Link
                          href={personHref(cohortId, person.id)}
                          className="block font-medium [overflow-wrap:anywhere] after:absolute after:inset-0"
                        >
                          {name}
                        </Link>
                      )}
                      <span className="text-foreground-secondary block [overflow-wrap:anywhere]">
                        {person.email}
                      </span>
                    </span>
                  </div>
                </td>
                <td className={BODY_CELL}>
                  <span className="flex flex-wrap items-center gap-2">
                    <RoleBadge person={person} />
                    {suspended ? (
                      <span className="bg-error-100 text-error-700 dark:bg-error-900/40 dark:text-error-300 inline-flex w-fit items-center rounded-full px-2.5 py-1 text-sm">
                        Suspended
                      </span>
                    ) : null}
                  </span>
                </td>
                <td className={`${BODY_CELL} text-foreground-secondary`}>
                  {person.trackName ?? "—"}
                </td>
                <td className={BODY_CELL}>
                  <PersonStatus cohortId={cohortId} userId={person.id} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
