"use client";

import { XIcon } from "@phosphor-icons/react/dist/ssr/X";
import { cn } from "cn";
import {
  type ClipboardEvent,
  type KeyboardEvent,
  useId,
  useState,
} from "react";

import { addEmails, isValidEmail } from "../invite-form";

// Addresses become chips as they are typed or pasted. Several at once are
// split at commas, semicolons, spaces and line breaks.
export function EmailTokenField({
  emails,
  onChange,
  invalid = false,
  describedBy,
}: {
  emails: readonly string[];
  onChange: (emails: string[]) => void;
  invalid?: boolean;
  describedBy?: string;
}) {
  const [draft, setDraft] = useState("");
  const inputId = useId();

  function commit(text: string) {
    setDraft("");
    if (text.trim()) onChange(addEmails(emails, text));
  }

  function change(value: string) {
    if (/[\s,;]/.test(value)) commit(value);
    else setDraft(value);
  }

  function paste(event: ClipboardEvent<HTMLInputElement>) {
    event.preventDefault();
    commit(draft + event.clipboardData.getData("text"));
  }

  function keyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" && draft.trim()) {
      event.preventDefault();
      commit(draft);
    }
    if (event.key === "Backspace" && draft === "" && emails.length > 0) {
      onChange(emails.slice(0, -1));
    }
  }

  return (
    <div
      className={cn(
        "border-input flex min-h-20 flex-wrap items-start gap-2 rounded-xl border p-2 focus-within:border-[#3155D6] dark:border-[#2B3B5F] dark:focus-within:border-[#3155D6]",
        invalid && "border-destructive",
      )}
    >
      <ul className="contents">
        {emails.map((email) => (
          <li
            key={email}
            className={cn(
              "inline-flex max-w-full items-center gap-1 rounded-full bg-[#EFFAFF] py-1 pr-3 pl-1 text-sm dark:bg-[#2B3B5F]",
              !isValidEmail(email) &&
                "bg-error-100 text-error-700 dark:bg-error-900/40 dark:text-error-300",
            )}
          >
            <button
              type="button"
              aria-label={`Remove ${email}`}
              onClick={() =>
                onChange(emails.filter((other) => other !== email))
              }
              className="grid size-5 shrink-0 cursor-pointer place-items-center rounded-full"
            >
              <XIcon aria-hidden size={12} />
            </button>
            <span className="[overflow-wrap:anywhere]">{email}</span>
          </li>
        ))}
      </ul>
      <input
        id={inputId}
        type="text"
        inputMode="email"
        autoComplete="off"
        aria-label="Emails"
        aria-invalid={invalid}
        aria-describedby={describedBy}
        value={draft}
        placeholder={emails.length === 0 ? "Add email…" : "Add another…"}
        onChange={(event) => change(event.target.value)}
        onPaste={paste}
        onKeyDown={keyDown}
        onBlur={() => commit(draft)}
        className="min-w-40 flex-1 bg-transparent py-1 text-sm outline-none"
      />
    </div>
  );
}
