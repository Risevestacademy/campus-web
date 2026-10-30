import Link from "next/link";

import { Avatar, AvatarFallback } from "@/shared/ui/avatar";

import { avatarTone, initialOf } from "../../feedback";
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

            return (
              <tr
                key={person.id}
                className="group/row hover:bg-[#E9ECF6] dark:hover:bg-[#2B3B5F]"
              >
                <td className={BODY_CELL}>
                  <Link
                    href={personHref(cohortId, person.id)}
                    className="flex items-center gap-3"
                  >
                    <Avatar size="lg">
                      <AvatarFallback className={avatarTone(person.id)}>
                        {initialOf(name)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="min-w-0">
                      <span className="block font-medium [overflow-wrap:anywhere]">
                        {name}
                      </span>
                      <span className="text-foreground-secondary block [overflow-wrap:anywhere]">
                        {person.email}
                      </span>
                    </span>
                  </Link>
                </td>
                <td className={BODY_CELL}>
                  <RoleBadge person={person} />
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
