import type { TrackFieldErrors, TrackFieldValues } from "../types/track.types";

export function TrackFormFields({
  values,
  errors = {},
}: {
  values?: Partial<TrackFieldValues>;
  errors?: TrackFieldErrors;
}) {
  return (
    <div className="grid gap-4">
      <label className="grid gap-2">
        Name
        <input
          name="name"
          defaultValue={values?.name}
          aria-invalid={Boolean(errors.name)}
          required
        />
      </label>
      <label className="grid gap-2">
        Code
        <input
          name="code"
          defaultValue={values?.code}
          aria-invalid={Boolean(errors.code)}
          required
        />
      </label>
      <label className="grid gap-2">
        Description
        <textarea
          name="description"
          defaultValue={values?.description}
          aria-invalid={Boolean(errors.description)}
        />
      </label>
      {Object.entries(errors).map(([field, message]) =>
        message ? (
          <p key={field} role="alert" className="text-destructive text-sm">
            {message}
          </p>
        ) : null,
      )}
    </div>
  );
}
