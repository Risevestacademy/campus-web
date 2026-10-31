"use client";

import { FileTextIcon } from "@phosphor-icons/react/dist/ssr/FileText";
import { PaperPlaneTiltIcon } from "@phosphor-icons/react/dist/ssr/PaperPlaneTilt";
import { XIcon } from "@phosphor-icons/react/dist/ssr/X";
import { useState } from "react";

import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/shared/ui/dialog";

import { plural, useImportInvites } from "../hooks/use-import-invites";
import { readInviteCsv, TEMPLATE_FILE_NAME, templateHref } from "../invite-csv";
import type {
  InviteImport,
  InviteImportProblem,
  InviteOptions,
} from "../types/invite.types";

const PROBLEM_MESSAGES: Record<InviteImportProblem, string | undefined> = {
  unreadable:
    "campus-api couldn't read this file. Check the first line names the columns, and that it has at most 500 rows.",
  invalid: "campus-api rejected this request. Refresh the page and try again.",
  "signed-out": undefined,
  forbidden: "You no longer have permission to send invites.",
  missing: "This cohort no longer exists. Refresh the page.",
  "rate-limited": "Too many invites at once. Wait a moment and try again.",
  unavailable:
    "We couldn't send this file. Nothing was confirmed sent. Check your connection and try again.",
};

interface PickedFile {
  file: File;
  rows: number;
}

function Stat({
  value,
  label,
  className,
}: {
  value: number;
  label: string;
  className: string;
}) {
  return (
    <div className={`rounded-2xl p-4 ${className}`}>
      <p className="text-3xl font-semibold">{value}</p>
      <p className="text-sm">{label}</p>
    </div>
  );
}

export function BulkInviteDialog({
  cohortId,
  options,
}: {
  cohortId: string;
  options: InviteOptions;
}) {
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<PickedFile>();
  const [fileError, setFileError] = useState<string>();
  const [imported, setImported] = useState<InviteImport>();

  const { send, isPending, problem, reset } = useImportInvites({
    cohortId,
    onDone: (done) => {
      if (done.failed.length === 0) {
        setPicked(undefined);
        setOpen(false);
      } else {
        setImported(done);
      }
    },
  });

  const tracks = options.tracks.kind === "loaded" ? options.tracks.options : [];

  function clear() {
    reset();
    setPicked(undefined);
    setFileError(undefined);
    setImported(undefined);
  }

  function changeOpen(next: boolean) {
    if (!next && isPending) return;
    if (next) clear();
    setOpen(next);
  }

  async function choose(file: File | undefined) {
    reset();
    setPicked(undefined);
    setFileError(undefined);
    if (!file) return;

    const read = readInviteCsv({
      name: file.name,
      size: file.size,
      text: await file.text(),
    });
    if (read.kind === "invalid") setFileError(read.message);
    else setPicked({ file, rows: read.rows });
  }

  const message = problem ? PROBLEM_MESSAGES[problem] : undefined;

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogTrigger render={<Button variant="outline" />}>
        <FileTextIcon aria-hidden />
        Bulk invite
      </DialogTrigger>
      <DialogContent
        showCloseButton={false}
        className="bg-background top-3 right-3 left-auto h-[calc(100dvh-1.5rem)] max-w-none translate-x-0 translate-y-0 grid-rows-[1fr] gap-0 overflow-y-auto rounded-3xl border border-[#D6E3EC] p-0 shadow-2xl ring-0 sm:max-w-xl dark:border-[#2B3B5F] dark:bg-[#1F2940]"
      >
        <div className="flex flex-col">
          <header className="flex shrink-0 items-start justify-between gap-4 border-b border-[#D6E3EC] px-6 py-5 dark:border-[#2B3B5F]">
            <div className="grid gap-1">
              <DialogTitle className="font-display text-3xl font-semibold">
                Bulk invite
              </DialogTitle>
              <DialogDescription className="text-foreground-secondary">
                {picked
                  ? `${picked.file.name} · ${picked.rows} row${picked.rows === 1 ? "" : "s"}`
                  : "Invite a whole file at once, to this cohort."}
              </DialogDescription>
            </div>
            <DialogClose
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="hover:bg-error-500 hover:text-error-50 dark:hover:bg-error-500 dark:hover:text-error-50 size-9 rounded-full bg-[#E6F2F7] dark:bg-[#2B3B5F]"
                />
              }
            >
              <XIcon aria-hidden />
              <span className="sr-only">Close</span>
            </DialogClose>
          </header>

          <div className="grid flex-1 content-start gap-5 p-6">
            {imported ? (
              <>
                <p role="status" className="sr-only">
                  {imported.invited === 0
                    ? "No invites sent"
                    : `${plural(imported.invited)} sent`}
                  , {imported.failed.length} not sent
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <Stat
                    value={imported.invited}
                    label="Invited"
                    className="bg-success-100 text-success-700 dark:bg-success-900/40 dark:text-success-300"
                  />
                  <Stat
                    value={imported.failed.length}
                    label="Not invited"
                    className="bg-error-100 text-error-700 dark:bg-error-900/40 dark:text-error-300"
                  />
                </div>
                <section
                  aria-labelledby="not-invited-heading"
                  className="grid gap-2"
                >
                  <h3 id="not-invited-heading" className="font-medium">
                    These rows were not invited
                  </h3>
                  <table className="w-full text-left text-sm">
                    <thead className="text-foreground-secondary text-xs uppercase">
                      <tr>
                        <th scope="col" className="py-2 pr-3 font-medium">
                          Row
                        </th>
                        <th scope="col" className="py-2 pr-3 font-medium">
                          Email
                        </th>
                        <th scope="col" className="py-2 font-medium">
                          Issue
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {imported.failed.map(({ line, email, reason }) => (
                        <tr
                          key={line}
                          className="border-t border-[#D6E3EC] align-top dark:border-[#2B3B5F]"
                        >
                          <td className="py-3 pr-3">Row {line}</td>
                          <td className="py-3 pr-3 [overflow-wrap:anywhere]">
                            {email}
                          </td>
                          <td className="text-destructive py-3">{reason}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="text-foreground-secondary text-sm">
                    Fix these rows and upload the file again. Rows already
                    invited are refused the second time as already invited.
                  </p>
                </section>
              </>
            ) : (
              <>
                <div className="grid gap-2">
                  <label className="focus-within:ring-ring/50 grid min-h-32 cursor-pointer place-items-center gap-1 rounded-2xl border-2 border-dashed border-[#D6E3EC] p-6 text-center text-sm focus-within:ring-3 hover:bg-[#E9ECF6] dark:border-[#2B3B5F] dark:hover:bg-[#2B3B5F]">
                    <FileTextIcon aria-hidden size={28} />
                    <span className="font-medium">
                      {picked ? picked.file.name : "Choose a CSV file"}
                    </span>
                    <span className="text-foreground-secondary">
                      Up to 500 rows and 256 KB
                    </span>
                    <input
                      type="file"
                      accept=".csv,text/csv"
                      disabled={isPending}
                      onChange={(event) => void choose(event.target.files?.[0])}
                      className="sr-only"
                    />
                  </label>
                </div>

                {fileError ? (
                  <p role="alert" className="text-destructive text-sm">
                    {fileError}
                  </p>
                ) : null}
                {message ? (
                  <p role="alert" className="text-destructive text-sm">
                    {message}
                  </p>
                ) : null}

                <div className="text-foreground-secondary grid gap-2 text-sm">
                  <p className="flex flex-wrap items-center gap-2">
                    Columns: email, role, track
                    <span aria-hidden>·</span>
                    <a
                      href={templateHref(tracks[0]?.code)}
                      download={TEMPLATE_FILE_NAME}
                      className="text-primary dark:text-cobalt-300 font-medium underline"
                    >
                      Download template
                    </a>
                  </p>
                  <p>
                    Role is student, professor or mentor. A student needs a
                    track code.
                  </p>
                  {tracks.length > 0 ? (
                    <p>
                      Track codes in this cohort:{" "}
                      {tracks
                        .map(({ code, name }) => `${code} (${name})`)
                        .join(", ")}
                    </p>
                  ) : null}
                </div>
              </>
            )}
          </div>

          <footer className="flex items-center justify-end gap-3 border-t border-[#D6E3EC] p-6 dark:border-[#2B3B5F]">
            {imported ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-11 px-6 text-base dark:border-[#2B3B5F]"
                  onClick={clear}
                >
                  Upload another file
                </Button>
                <DialogClose
                  render={
                    <Button
                      type="button"
                      size="sm"
                      className="h-11 px-6 text-base"
                    />
                  }
                >
                  Done
                </DialogClose>
              </>
            ) : (
              <>
                <DialogClose
                  disabled={isPending}
                  render={
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="hover:border-error-500 hover:bg-error-500 hover:text-error-50 dark:hover:border-error-500 dark:hover:bg-error-500 dark:hover:text-error-50 h-11 px-6 text-base dark:border-[#2B3B5F]"
                    />
                  }
                >
                  Cancel
                </DialogClose>
                <Button
                  type="button"
                  size="sm"
                  className="h-11 px-6 text-base"
                  disabled={!picked || isPending}
                  onClick={() => picked && send(picked.file)}
                >
                  <PaperPlaneTiltIcon aria-hidden />
                  {isPending
                    ? "Sending…"
                    : picked
                      ? `Send ${picked.rows} invite${picked.rows === 1 ? "" : "s"}`
                      : "Send invites"}
                </Button>
              </>
            )}
          </footer>
        </div>
      </DialogContent>
    </Dialog>
  );
}
