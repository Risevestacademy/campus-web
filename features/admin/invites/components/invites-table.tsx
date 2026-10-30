import { RoleBadge } from "../../role-badge";
import { sentOn } from "../invite-format";
import type { Invite } from "../types/invite.types";
import { InviteActions } from "./invite-actions";
import { InviteExpiry } from "./invite-expiry";

const HEADER_CELL = "bg-[#EFFAFF] px-4 py-3 font-medium dark:bg-[#2B3B5F]";
const BODY_CELL =
  "border-border border-b px-4 py-4 group-last/row:border-b-0 dark:border-[#2B3B5F]";

export function InvitesTable({
  invites,
  now,
}: {
  invites: readonly Invite[];
  now: number;
}) {
  return (
    <div className="border-border overflow-x-auto rounded-3xl border p-3 dark:border-[#2B3B5F]">
      <table className="w-full min-w-176 border-separate border-spacing-0 text-left text-sm">
        <caption className="sr-only">Invites</caption>
        <thead>
          <tr className="text-foreground-secondary text-xs tracking-wider uppercase">
            <th scope="col" className={`${HEADER_CELL} rounded-l-[0.5rem]`}>
              Email
            </th>
            <th scope="col" className={HEADER_CELL}>
              Role
            </th>
            <th scope="col" className={HEADER_CELL}>
              Expiry
            </th>
            <th scope="col" className={`${HEADER_CELL} rounded-r-[0.5rem]`}>
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {invites.map((invite) => (
            <tr key={invite.id} className="group/row">
              <td className={BODY_CELL}>
                <span className="block font-medium [overflow-wrap:anywhere]">
                  {invite.email}
                </span>
                <span className="text-foreground-secondary block">
                  {sentOn(invite)}
                </span>
              </td>
              <td className={BODY_CELL}>
                <RoleBadge
                  person={{
                    systemRole: "user",
                    role: invite.cohortRole ?? undefined,
                  }}
                />
              </td>
              <td className={BODY_CELL}>
                <InviteExpiry invite={invite} now={now} />
              </td>
              <td className={`${BODY_CELL} text-right`}>
                <InviteActions
                  inviteId={invite.id}
                  email={invite.email}
                  status={invite.status}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
