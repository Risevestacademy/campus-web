# Uploads

Sends one file to campus-api's storage and answers its `mediaId`, which the
caller hands to the endpoint that uses it (`PUT /v1/users/me/avatar` for a
profile picture). Shared because notices, feedback and the profile all upload
the same way.

## Interface

```ts
import { uploadMedia } from "@/core/uploads";

const result = await uploadMedia({
  api: browserApi,
  kind: "avatar",
  file: picture,
  onProgress: (fraction) => …,
  signal: controller.signal,
});
// { kind: "uploaded", mediaId } or { kind: "problem", problem }
```

`uploadMedia`:

1. reads `GET /v1/uploads/limits` and refuses a type the kind does not take or
   a file over its size before asking for anything;
2. signs a PUT with `POST /v1/uploads` (`kind`, `contentType`, `sizeBytes`,
   and `fileName` when given);
3. PUTs the file straight to the signed `uploadUrl` with exactly the signed
   headers, through `XMLHttpRequest` so `onProgress` gets a fraction from 0
   to 1, and aborts on `signal`;
4. signs again and retries once when storage answers 403, an expired URL.

A problem is `type-not-allowed` (with the `allowed` types), `too-large` (with
`maxBytes`), `rate-limited`, `signed-out`, `cancelled` or `unavailable`.
Nothing is thrown. An upload nothing uses is deleted by campus-api within the
hour, so a picked file that is dropped needs no call.

## Modules

| Module             | Owns                                                       |
| ------------------ | ---------------------------------------------------------- |
| `upload-media.ts`  | limits check, signing, the one retry, and the result       |
| `put-file.ts`      | the PUT to storage with progress and cancel                |
| `upload.schema.ts` | parsing the limits, the signed upload and the 413/415 body |
| `types.ts`         | the kinds, results and problems                            |
| `whole-megabytes`  | how a size limit is read out to the member                 |

## Contributing

- Parse what campus-api sends in `upload.schema.ts`. The signed upload keeps
  only `mediaId`, an https `uploadUrl` and the `headers`; the limits keep each
  known kind's types and size. Both are bound to the generated `UploadDto` and
  `UploadKindLimitsDto` with `z.toZod`, so a contract change fails typecheck;
  the 413 and 415 readers are bound by their error codes. Update the allow-lists in
  `tests/evals/data-privacy.eval.test.ts` with any change.
- `/v1/uploads` and `/v1/uploads/limits` are forwarded by the browser proxy;
  storage is reached directly.
- `call_chat_attachment` is the kind for a file sent in a call's chat: upload it
  with `uploadMedia`, tie it to the call with `POST
/v1/cohorts/{cohortId}/spaces/{spaceId}/call/attachments`, then send the line
  through world with the file.

## Tests

```bash
pnpm vitest run --project=unit core/uploads
```

`upload-media.test.ts` runs against a mock campus-api with the PUT injected;
`put-file.test.ts` drives the real `XMLHttpRequest`. jsdom does not hand a
Blob body to the interceptor, so the PUT's body is not checked there.
