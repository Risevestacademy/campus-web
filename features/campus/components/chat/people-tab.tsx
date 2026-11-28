"use client";

import type { ChatPeople } from "../../services/chat/chat-people";
import { PersonRow } from "./person-row";

// Who is in the meeting, the member first.
export function PeopleTab({
  localId,
  people,
}: Readonly<Pick<ChatPeople, "localId" | "people">>) {
  const alone = people.length <= 1;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto p-2">
      <ul className="flex flex-col">
        {people.map((participant) => (
          <PersonRow
            key={participant.id}
            isLocal={participant.id === localId}
            participant={participant}
          />
        ))}
      </ul>
      {alone ? (
        <p className="text-foreground-secondary px-2 pt-2 text-sm">
          Nobody else is here.
        </p>
      ) : null}
    </div>
  );
}
