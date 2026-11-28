"use client";

import { type FormEvent, useId, useState } from "react";

import { Button } from "@/shared/ui/button";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/shared/ui/field";
import { Input } from "@/shared/ui/input";
import { NativeSelect } from "@/shared/ui/native-select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/ui/tooltip";

import {
  AdminSheet,
  AdminSheetCancel,
  SHEET_ACTION_CLASS_NAME,
} from "../../admin-sheet";
import { useUpdateSpace } from "../hooks/use-update-space";
import {
  parseSpaceEdit,
  type SpaceFieldValues,
} from "../schemas/space-form.schema";
import type { ViewSpace } from "../services/map-view";
import type {
  SpaceAccess,
  SpaceSettings,
  SpaceUpdateProblem,
} from "../types/maps.types";
import { SpaceAccessList } from "./space-access-list";
import {
  ACCESS_LABELS,
  AUDIO_LABELS,
  AUDIO_MODES,
  KIND_LABELS,
  SPACE_KINDS,
} from "./space-labels";

const PROBLEM_MESSAGES: Readonly<
  Record<SpaceUpdateProblem, string | undefined>
> = {
  invalid: "campus-api refused one of these values. Check them and try again.",
  "kind-taken":
    "The campus already has one of this kind. Only one town hall and one notice board may exist.",
  missing: "This space no longer exists. Refresh the page.",
  "signed-out": undefined,
  forbidden: "Only administrators can change spaces.",
  unavailable:
    "We couldn't save this space. Check your connection and try again.",
};

type FieldErrors = Partial<Record<keyof SpaceFieldValues, string>>;

// A space's settings, in the sheet at the side of the screen. A space the
// campus doesn't have yet has nothing to set up, and says so.
export function SpaceSheet({
  space,
  onClose,
}: {
  space: ViewSpace;
  onClose: () => void;
}) {
  if (space.settings) {
    return (
      <SpaceForm
        key={settingsKey(space.settings)}
        space={space.settings}
        onClose={onClose}
      />
    );
  }

  return (
    <AdminSheet
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={space.name}
      description={<code className="font-mono text-xs">{space.key}</code>}
      footer={<AdminSheetCancel>Close</AdminSheetCancel>}
    >
      <p className="bg-surface-elevated text-foreground-secondary rounded-xl p-4 text-sm">
        {space.change === "restored"
          ? "Sync first. This space comes back with the settings it had before it was retired."
          : "Sync first. This space isn't in the campus yet, so there is nothing to set up."}
      </p>
    </AdminSheet>
  );
}

// A saved edit comes back through the page's refresh; keying the form by the
// values it started from resets it to them.
function settingsKey(space: SpaceSettings): string {
  return [space.id, space.name, space.kind, space.access, space.audioMode].join(
    "|",
  );
}

function SpaceForm({
  space,
  onClose,
}: {
  space: SpaceSettings;
  onClose: () => void;
}) {
  const id = useId();
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string>();
  const [unchanged, setUnchanged] = useState(false);
  // Read as it changes, so the list shows as soon as the space is made
  // designated, before it is saved.
  const [access, setAccess] = useState<SpaceAccess>(space.access);
  const saving = useUpdateSpace({
    spaceId: space.id,
    name: space.name,
    onSaved: onClose,
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const read = parseSpaceEdit(space, new FormData(event.currentTarget));
    setErrors(read.kind === "invalid" ? read.errors : {});
    setFormError(read.kind === "invalid" ? read.formError : undefined);
    setUnchanged(read.kind === "unchanged");
    if (read.kind === "valid") {
      saving.save(read.changes);
    } else {
      saving.reset();
    }
  }

  const alertMessage =
    formError ??
    (saving.problem ? PROBLEM_MESSAGES[saving.problem] : undefined);

  return (
    <AdminSheet
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title="Space settings"
      description={<code className="font-mono text-xs">{space.key}</code>}
      onSubmit={submit}
      footer={
        <>
          <AdminSheetCancel disabled={saving.isPending} />
          <Button
            type="submit"
            size="sm"
            disabled={saving.isPending}
            className={SHEET_ACTION_CLASS_NAME}
          >
            {saving.isPending ? "Saving…" : "Save space"}
          </Button>
        </>
      }
    >
      {alertMessage ? (
        <p role="alert" className="text-destructive text-sm">
          {alertMessage}
        </p>
      ) : null}
      {unchanged ? (
        <p role="alert" className="text-sm">
          Nothing has changed yet.
        </p>
      ) : null}
      <FieldGroup className="gap-5">
        <Field data-invalid={Boolean(errors.name)}>
          <FieldLabel htmlFor={`${id}-name`}>Name</FieldLabel>
          <Input
            id={`${id}-name`}
            name="name"
            defaultValue={space.name}
            autoComplete="off"
            aria-invalid={Boolean(errors.name)}
            required
          />
          {errors.name ? <FieldError>{errors.name}</FieldError> : null}
        </Field>

        <Field data-invalid={Boolean(errors.kind)}>
          <FieldLabel htmlFor={`${id}-kind`}>Room type</FieldLabel>
          <NativeSelect
            id={`${id}-kind`}
            name="kind"
            defaultValue={space.kind ?? ""}
            aria-invalid={Boolean(errors.kind)}
          >
            {space.kind === null ? (
              <option value="">Choose a type</option>
            ) : null}
            {SPACE_KINDS.map((kind) => (
              <option key={kind} value={kind}>
                {KIND_LABELS[kind]}
              </option>
            ))}
          </NativeSelect>
          {errors.kind ? <FieldError>{errors.kind}</FieldError> : null}
        </Field>

        <FieldSet>
          <FieldLegend variant="label">Audio mode</FieldLegend>
          <div className="grid grid-cols-2 gap-2">
            {AUDIO_MODES.map((mode) => (
              <Tooltip key={mode}>
                <TooltipTrigger
                  render={
                    <label className="border-border has-checked:border-primary has-checked:bg-surface-elevated has-checked:text-brand-foreground has-focus-visible:ring-ring/50 flex min-h-11 cursor-pointer items-center rounded-lg border px-3 text-sm has-checked:font-semibold has-focus-visible:ring-3" />
                  }
                >
                  <input
                    type="radio"
                    name="audioMode"
                    value={mode}
                    defaultChecked={space.audioMode === mode}
                    className="sr-only"
                  />
                  {AUDIO_LABELS[mode].label}
                  <span className="sr-only">
                    {`: ${AUDIO_LABELS[mode].description}`}
                  </span>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  {AUDIO_LABELS[mode].description}
                </TooltipContent>
              </Tooltip>
            ))}
          </div>
        </FieldSet>

        <Field>
          <FieldLabel htmlFor={`${id}-access`}>Who can enter</FieldLabel>
          <NativeSelect
            id={`${id}-access`}
            name="access"
            value={access}
            onChange={(event) => setAccess(event.target.value as SpaceAccess)}
          >
            {Object.entries(ACCESS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </NativeSelect>
        </Field>
        {access === "designated" ? (
          <SpaceAccessList spaceId={space.id} savedAccess={space.access} />
        ) : null}
      </FieldGroup>
    </AdminSheet>
  );
}
