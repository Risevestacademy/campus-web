import { avatarToneOf, initialOf } from "@/shared/lib/avatar";
import { Avatar, AvatarFallback, AvatarImage } from "@/shared/ui/avatar";

import { RoleBadge } from "../../role-badge";
import { formerEndedOn, formerOutcomeOf, personName } from "../people-format";
import type { RosterMember } from "../types/people.types";
import { BODY_CELL, HEADER_CELL } from "./people-table";

// Former members are not linked: a person's page shows only someone the
// profile card still places in this cohort. The roster sends no system role,
// so the badge shows the role they held here.
export function FormerMembersTable({
  members,
}: {
  members: readonly RosterMember[];
}) {
  return (
    <div className="border-border overflow-x-auto rounded-3xl border p-3 dark:border-[#2B3B5F]">
      <table className="w-full min-w-176 border-separate border-spacing-0 text-left text-sm">
        <caption className="sr-only">Former members</caption>
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
            <th scope="col" className={HEADER_CELL}>
              Outcome
            </th>
            <th scope="col" className={`${HEADER_CELL} rounded-r-[0.5rem]`}>
              Ended
            </th>
          </tr>
        </thead>
        <tbody>
          {members.map((member) => {
            const name = personName(member.user);
            const endedOn = formerEndedOn(member);

            return (
              <tr key={member.user.id} className="group/row">
                <td className={BODY_CELL}>
                  <div className="flex items-center gap-3">
                    <Avatar size="lg">
                      {member.user.avatarUrl ? (
                        <AvatarImage src={member.user.avatarUrl} alt="" />
                      ) : null}
                      <AvatarFallback className={avatarToneOf(member.user.id)}>
                        {initialOf(name)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="min-w-0">
                      <span className="block font-medium [overflow-wrap:anywhere]">
                        {name}
                      </span>
                      <span className="text-foreground-secondary block [overflow-wrap:anywhere]">
                        {member.user.email}
                      </span>
                    </span>
                  </div>
                </td>
                <td className={BODY_CELL}>
                  <RoleBadge
                    person={{ systemRole: "user", role: member.role }}
                  />
                </td>
                <td className={`${BODY_CELL} text-foreground-secondary`}>
                  {member.track?.name ?? "—"}
                </td>
                <td className={BODY_CELL}>
                  <span className="block">{formerOutcomeOf(member)}</span>
                  {member.dismissalReason ? (
                    <span className="text-foreground-secondary block [overflow-wrap:anywhere]">
                      {member.dismissalReason}
                    </span>
                  ) : null}
                </td>
                <td className={`${BODY_CELL} text-foreground-secondary`}>
                  {endedOn ?? "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
