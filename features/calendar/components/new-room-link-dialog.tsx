"use client";

import { type FormEvent, useId, useState } from "react";

import { Button } from "@/shared/ui/button";
import {
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { NativeSelect } from "@/shared/ui/native-select";
import { toast } from "@/shared/ui/toast";

import { useCreateRoomLink } from "../hooks/use-create-room-link";
import { useLinkableSpaces } from "../hooks/use-linkable-spaces";
import type { OwnSpace } from "../hooks/use-own-space";
import {
  type CreatedRoomLink,
  ROOM_LINK_TITLE_LIMIT,
} from "../schemas/room-link.schema";
import { noticeForProblem } from "../services/room-link-notice";

type Props = Readonly<{
  cohortId: string;
  // Admins choose any space. Staff who are not admins are given the one they
  // stand in, and have no choice.
  space: { kind: "any" } | { kind: "own"; space: OwnSpace };
}>;

// Make a link for an event. It does not make the event: the link is pasted
// into one in the member's own Google Calendar.
export function NewRoomLinkForm({ cohortId, space }: Props) {
  const [created, setCreated] = useState<CreatedRoomLink>();

  return created ? (
    <CreatedLink link={created} />
  ) : (
    <MakeLink cohortId={cohortId} space={space} onCreated={setCreated} />
  );
}

function MakeLink({
  cohortId,
  space,
  onCreated,
}: Props & { onCreated: (link: CreatedRoomLink) => void }) {
  const titleId = useId();
  const spaceId = useId();
  const [title, setTitle] = useState("");
  const [chosen, setChosen] = useState("");
  const [problem, setProblem] = useState<string>();
  const create = useCreateRoomLink(cohortId);
  const spaces = useLinkableSpaces(space.kind === "any");

  const trimmed = title.trim();
  const target = space.kind === "own" ? space.space.id : chosen;
  const ready = trimmed.length > 0 && target !== "" && !create.isPending;

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!ready) return;
    setProblem(undefined);
    create.mutate(
      { spaceId: target, title: trimmed },
      {
        onSuccess(result) {
          if (result.kind === "created") onCreated(result.link);
          else setProblem(noticeForProblem(result.problem));
        },
      },
    );
  }

  return (
    <form onSubmit={submit} className="grid gap-4">
      <DialogHeader>
        <DialogTitle>New room link</DialogTitle>
        <DialogDescription>
          Make a link for an event, then paste it into the location or
          description of a Google Calendar event you organise. Campus
          doesn&rsquo;t create the event.
        </DialogDescription>
      </DialogHeader>

      <div className="grid gap-1.5">
        <Label htmlFor={titleId}>Event name</Label>
        <Input
          id={titleId}
          value={title}
          maxLength={ROOM_LINK_TITLE_LIMIT}
          autoComplete="off"
          onChange={(event) => setTitle(event.target.value)}
        />
      </div>

      {space.kind === "own" ? (
        <p className="text-sm">
          Your link will open {space.space.name}. To make one for another space,
          walk into it first.
        </p>
      ) : (
        <div className="grid gap-1.5">
          <Label htmlFor={spaceId}>Space</Label>
          <NativeSelect
            id={spaceId}
            value={chosen}
            disabled={spaces.data?.kind !== "loaded"}
            onChange={(event) => setChosen(event.target.value)}
          >
            <option value="">
              {spaces.isPending ? "Loading spaces…" : "Choose a space"}
            </option>
            {spaces.data?.kind === "loaded"
              ? spaces.data.spaces.map(({ id, name }) => (
                  <option key={id} value={id}>
                    {name}
                  </option>
                ))
              : null}
          </NativeSelect>
          {spaces.data && spaces.data.kind !== "loaded" ? (
            <p role="alert" className="text-error-foreground text-sm">
              {spaces.data.kind === "forbidden"
                ? "You can't make room links for this cohort."
                : "We couldn't load the spaces. Close this and try again."}
            </p>
          ) : null}
        </div>
      )}

      {problem ? (
        <p role="alert" className="text-error-foreground text-sm">
          {problem}
        </p>
      ) : null}

      <DialogFooter>
        <DialogClose render={<Button variant="outline" type="button" />}>
          Cancel
        </DialogClose>
        <Button type="submit" disabled={!ready}>
          {create.isPending ? "Making…" : "Make link"}
        </Button>
      </DialogFooter>
    </form>
  );
}

function CreatedLink({ link }: Readonly<{ link: CreatedRoomLink }>) {
  const addressId = useId();

  async function copy() {
    try {
      await navigator.clipboard.writeText(link.url);
      toast.add({ title: "Room link copied.", type: "success" });
    } catch {
      toast.add({ title: "We couldn't copy the link.", type: "warning" });
    }
  }

  return (
    <div className="grid gap-4">
      <DialogHeader>
        <DialogTitle>Room link ready</DialogTitle>
        <DialogDescription>
          {link.title} · {link.spaceName}
        </DialogDescription>
      </DialogHeader>
      <div className="grid gap-1.5">
        <Label htmlFor={addressId}>Link</Label>
        <div className="flex gap-2">
          <Input
            id={addressId}
            readOnly
            value={link.url}
            onFocus={(event) => event.currentTarget.select()}
          />
          <Button variant="outline" onClick={() => void copy()}>
            Copy link
          </Button>
        </div>
      </div>
      <p className="text-foreground-secondary text-sm text-pretty">
        Paste it into the location or description of a Google Calendar event you
        organise. Campus doesn&rsquo;t create the event. Once Google has it, it
        shows here, and people can enter from ten minutes before it starts.
      </p>
      <DialogFooter>
        <DialogClose render={<Button type="button" />}>Done</DialogClose>
      </DialogFooter>
    </div>
  );
}
