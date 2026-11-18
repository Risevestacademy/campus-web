"use client";

import { FileTextIcon } from "@phosphor-icons/react/dist/ssr/FileText";
import { PaperPlaneTiltIcon } from "@phosphor-icons/react/dist/ssr/PaperPlaneTilt";
import { useRef, useState } from "react";

import { Button } from "@/shared/ui/button";
import { DialogClose } from "@/shared/ui/dialog";

import { useImportInvites } from "../hooks/use-import-invites";
import {
  CSV_MAX_BYTES,
  CSV_MAX_ROWS,
  readInviteCsv,
  TEMPLATE_FILE_NAME,
  templateHref,
} from "../invite-csv";
import { plural } from "../invite-format";
import type {
  InviteImport,
  InviteImportProblem,
  InviteOptions,
} from "../types/invite.types";
import {
  InvitePopup,
  InvitePopupCancel,
  POPUP_ACTION_CLASS_NAME,
} from "./invite-popup";

const PROBLEM_MESSAGES: Record<InviteImportProblem, string | undefined> = {
  unreadable: `campus-api couldn't read this file. Check the first line names the columns, and that it has at most ${CSV_MAX_ROWS} rows.`,
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

// What a screen reader hears when the result replaces the form.
function summaryOf({ invited, notEmailed, failed }: InviteImport): string {
  const made =
    invited === 0
      ? "No invites sent"
      : notEmailed > 0
        ? `${plural(invited, "invite")} created, ${notEmailed} without an email`
        : `${plural(invited, "invite")} sent`;

  return `${made}, ${failed.length} not sent`;
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
  // Reading a file takes a moment, so a second pick can start before the first
  // is read. Only the latest pick may set the state.
  const latestPick = useRef(0);

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
    latestPick.current += 1;
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
    const pick = ++latestPick.current;
    reset();
    setPicked(undefined);
    setFileError(undefined);
    if (!file) return;

    const read = readInviteCsv({
      name: file.name,
      size: file.size,
      text: await file.text(),
    });
    if (pick !== latestPick.current) return;

    if (read.kind === "invalid") setFileError(read.message);
    else setPicked({ file, rows: read.rows });
  }

  const message = problem ? PROBLEM_MESSAGES[problem] : undefined;

  return (
    <InvitePopup
      open={open}
      onOpenChange={changeOpen}
      triggerIcon={<FileTextIcon aria-hidden />}
      triggerLabel="Bulk invite"
      triggerVariant="outline"
      title="Bulk invite"
      description={
        picked
          ? `${picked.file.name} · ${plural(picked.rows, "row")}`
          : "Invite a whole file at once, to this cohort."
      }
      footer={
        imported ? (
          <>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className={`${POPUP_ACTION_CLASS_NAME} dark:border-[#2B3B5F]`}
              onClick={clear}
            >
              Upload another file
            </Button>
            <DialogClose
              render={
                <Button
                  type="button"
                  size="sm"
                  className={POPUP_ACTION_CLASS_NAME}
                />
              }
            >
              Done
            </DialogClose>
          </>
        ) : (
          <>
            <InvitePopupCancel disabled={isPending} />
            <Button
              type="button"
              size="sm"
              className={POPUP_ACTION_CLASS_NAME}
              disabled={!picked || isPending}
              onClick={() => picked && send(picked.file)}
            >
              <PaperPlaneTiltIcon aria-hidden />
              {isPending
                ? "Sending…"
                : picked
                  ? `Send ${plural(picked.rows, "invite")}`
                  : "Send invites"}
            </Button>
          </>
        )
      }
    >
      {imported ? (
        <>
          <p role="status" className="sr-only">
            {summaryOf(imported)}
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
          {imported.notEmailed > 0 ? (
            <p className="text-foreground-secondary text-sm">
              {plural(imported.notEmailed, "invite")} created without an email.
              Resend {imported.notEmailed === 1 ? "it" : "them"} from the list.
            </p>
          ) : null}
          <section aria-labelledby="not-invited-heading" className="grid gap-2">
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
              Fix these rows and upload the file again. Rows already invited are
              refused the second time as already invited.
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
                Up to {CSV_MAX_ROWS} rows and {CSV_MAX_BYTES / 1024} KB
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
              Role is student, professor or mentor. A student needs a track
              code.
            </p>
            {tracks.length > 0 ? (
              <p>
                Track codes in this cohort:{" "}
                {tracks.map(({ code, name }) => `${code} (${name})`).join(", ")}
              </p>
            ) : null}
          </div>
        </>
      )}
    </InvitePopup>
  );
}
