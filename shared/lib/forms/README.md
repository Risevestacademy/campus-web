# Forms

`parseForm(schema, form)` reads a `FormData` through a `z.object` schema and
returns `{ kind: "valid", data }` or
`{ kind: "invalid", errors, formError? }`.

## Contract

- Only the schema's top-level fields are read.
- A field absent from the form reads as `undefined`, so a required schema
  reports it. An unticked checkbox is absent: model it as
  `z.string().optional()`.
- A field sent once reads as its value (`string` or `File`); a field sent more
  than once reads as an array.
- `errors` holds the first message per field. An issue that names no field
  (a `.refine` without `path`) becomes `formError`; every form shows it in
  its alert slot, or submitting would do nothing visible.

`optionalText()` and `optionalIsoDate(error)` read an empty or blank field as
absent.
