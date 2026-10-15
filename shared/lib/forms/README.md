# Forms

`parseForm(schema, form)` reads a `FormData` through a `z.object` schema and
returns `{ kind: "valid", data }` or
`{ kind: "invalid", errors, formError? }`.

## Contract

- Only the schema's top-level fields are read.
- Each field reads one value (`string` or `File`); a repeated field reads its
  first. No form has an array field: add array reading with the first one.
- A field absent from the form (an unticked checkbox, a disabled input) reads
  as `""`, so the field's own `.min()` message shows.
- `z.coerce.number()` reads `""` as `0`. A number field must reject `""`
  first: `z.string().min(1, msg).pipe(z.coerce.number())`.
- `errors` holds the first message per field. An issue that names no field
  (a `.refine` without `path`) becomes `formError`; every form shows it in
  its alert slot, or submitting would do nothing visible.

`optionalText()` and `optionalIsoDate(error)` read an empty or blank field as
absent.
