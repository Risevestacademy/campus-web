"use client";

import { PaperPlaneTiltIcon } from "@phosphor-icons/react/dist/ssr/PaperPlaneTilt";
import { type ClipboardEvent, type FormEvent, useId, useState } from "react";

import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Textarea } from "@/shared/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/shared/ui/toggle-group";

import { feedbackKinds } from "./feedback-kinds";
import { FIELD_CLASS, FieldError } from "./form-field";
import { ReportPersonField } from "./report-person-field";
import {
  DETAILS_MAX_LENGTH,
  type FeedbackFieldErrors,
  feedbackKindSchema,
  LOCATION_MAX_LENGTH,
  parseFeedback,
  pickScreenshot,
  screenshotProblem,
  TITLE_MAX_LENGTH,
} from "./schemas/feedback.schema";
import { ScreenshotField, type SelectedScreenshot } from "./screenshot-field";
import type { FeedbackKind, NewFeedback } from "./types";

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

// Cells copied from Excel, Numbers or Word carry an image of themselves
// beside the text; in a text field the text is what was meant.
function isTextIntoField(event: ClipboardEvent<HTMLFormElement>): boolean {
  const { target } = event;
  const isTextField =
    target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement;
  return isTextField && event.clipboardData.types.includes("text/plain");
}

export function FeedbackForm({
  cohortId,
  userId,
  isSending,
  sendError,
  onCancel,
  onSubmit,
}: {
  cohortId: string | undefined;
  userId: string | undefined;
  isSending: boolean;
  sendError: string | undefined;
  onCancel: () => void;
  onSubmit: (feedback: NewFeedback) => void;
}) {
  const id = useId();
  const [kind, setKind] = useState<FeedbackKind>();
  const [errors, setErrors] = useState<FeedbackFieldErrors>({});
  const [formError, setFormError] = useState<string>();
  const [screenshot, setScreenshot] = useState<SelectedScreenshot>();
  const [screenshotError, setScreenshotError] = useState<string>();

  async function selectScreenshot(file: File) {
    const problem = screenshotProblem(file);
    setScreenshotError(problem);
    if (problem) return;

    try {
      setScreenshot({ name: file.name, previewUrl: await readAsDataUrl(file) });
    } catch {
      setScreenshotError("We couldn't read that image. Try another one.");
    }
  }

  function pasteScreenshot(event: ClipboardEvent<HTMLFormElement>) {
    if (isTextIntoField(event)) return;

    const file = pickScreenshot(event.clipboardData.files);
    if (!file) return;

    event.preventDefault();
    void selectScreenshot(file);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const read = parseFeedback(new FormData(event.currentTarget));

    setErrors(read.kind === "invalid" ? read.errors : {});
    setFormError(read.kind === "invalid" ? read.formError : undefined);
    if (read.kind === "valid") onSubmit(read.feedback);
  }

  return (
    <form
      noValidate
      onSubmit={submit}
      onPaste={pasteScreenshot}
      className="grid content-start gap-5"
    >
      <FieldError message={formError ?? sendError} />
      <fieldset className="grid gap-2">
        <legend className="mb-2 text-sm font-medium">
          What kind of feedback?
        </legend>
        <ToggleGroup
          value={kind ? [kind] : []}
          onValueChange={(next) => {
            const picked = feedbackKindSchema.safeParse(next[0]);
            if (picked.success) setKind(picked.data);
          }}
          aria-label="Kind of feedback"
          className="grid w-full grid-cols-1 gap-3 sm:grid-cols-3"
        >
          {feedbackKinds.map(({ id: kindId, Icon, label }) => (
            <ToggleGroupItem
              key={kindId}
              value={kindId}
              variant="outline"
              className="data-pressed:border-cobalt-500 dark:data-pressed:border-cobalt-400 h-12 justify-start gap-2 rounded-xl px-4 text-sm hover:bg-[#E9ECF6] data-pressed:border-2 data-pressed:bg-[#E9ECF6] data-pressed:text-inherit dark:border-[#2B3B5F] dark:hover:bg-[#2B3B5F] dark:data-pressed:bg-[#2B3B5F]"
            >
              <Icon aria-hidden size={18} />
              {label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <input type="hidden" name="kind" value={kind ?? ""} />
        <FieldError message={errors.kind} />
      </fieldset>

      <div className="grid gap-2">
        <Label htmlFor={`${id}-title`}>Title</Label>
        <Input
          id={`${id}-title`}
          name="title"
          maxLength={TITLE_MAX_LENGTH + 20}
          aria-invalid={errors.title ? true : undefined}
          className={FIELD_CLASS}
        />
        <FieldError message={errors.title} />
      </div>

      <div className="grid gap-2">
        <Label htmlFor={`${id}-details`}>Details</Label>
        <Textarea
          id={`${id}-details`}
          name="details"
          maxLength={DETAILS_MAX_LENGTH + 100}
          aria-invalid={errors.details ? true : undefined}
          className="min-h-32 rounded-xl px-4 py-3 focus-visible:border-[#3155D6] dark:border-[#2B3B5F] dark:focus-visible:border-[#3155D6]"
        />
        <FieldError message={errors.details} />
      </div>

      {kind === "report" ? (
        <ReportPersonField
          cohortId={cohortId}
          userId={userId}
          error={errors.reportedUserId}
        />
      ) : null}

      <div className="grid gap-2">
        <Label htmlFor={`${id}-location`}>
          Where in Campus?
          <span className="text-foreground-muted text-xs font-normal">
            Optional
          </span>
        </Label>
        <Input
          id={`${id}-location`}
          name="location"
          maxLength={LOCATION_MAX_LENGTH + 20}
          aria-invalid={errors.location ? true : undefined}
          className={FIELD_CLASS}
        />
        <FieldError message={errors.location} />
      </div>

      <div className="grid gap-2">
        <p className="flex items-center gap-2 text-sm font-medium">
          Screenshot
          <span className="text-foreground-muted text-xs font-normal">
            Optional
          </span>
        </p>
        <ScreenshotField
          screenshot={screenshot}
          problem={screenshotError}
          onSelect={(file) => void selectScreenshot(file)}
          onRemove={() => {
            setScreenshot(undefined);
            setScreenshotError(undefined);
          }}
        />
      </div>

      <div className="flex justify-end gap-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="hover:border-error-500 hover:bg-error-500 hover:text-error-50 dark:hover:border-error-500 dark:hover:bg-error-500 dark:hover:text-error-50 h-11 px-6 text-base dark:border-[#2B3B5F]"
          onClick={onCancel}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          size="sm"
          disabled={isSending}
          className="h-11 px-6 text-base"
        >
          <PaperPlaneTiltIcon aria-hidden />
          {isSending ? "Sending…" : "Send feedback"}
        </Button>
      </div>
    </form>
  );
}
