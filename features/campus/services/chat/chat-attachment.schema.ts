import { z } from "zod";

import type { components } from "@/core/api/client";
import type { Simplify } from "@/core/api/schemas";
import type { ChatAttachment } from "@/core/realtime";

type Schemas = components["schemas"];

// What a chat line carries of a file, from what campus-api answers when it ties
// one to the call: only these fields are kept, and the link it also sends is
// not, since a line carries none (everyone who opens the file asks for a link
// of their own).
const attachedFileSchema = z.toZod<
  Simplify<
    Pick<
      Schemas["AttachmentDto"],
      "id" | "fileName" | "contentType" | "sizeBytes"
    >
  >
>()(
  z.object({
    id: z.string().min(1),
    fileName: z.string().max(255).nullable(),
    contentType: z.string().min(1).max(255),
    sizeBytes: z.number().int().min(0),
  }),
);

export function parseAttachedFile(body: unknown): ChatAttachment | undefined {
  const file = attachedFileSchema.safeParse(body).data;
  return (
    file && {
      mediaId: file.id,
      fileName: file.fileName,
      contentType: file.contentType,
      sizeBytes: file.sizeBytes,
    }
  );
}

// A fresh link to open a file with. It is only ever followed over https, like
// the address a file is uploaded to.
const fileLinkSchema = z.toZod<
  Simplify<Pick<Schemas["AttachmentDto"], "url">>
>()(z.object({ url: z.url({ protocol: /^https$/ }) }));

export function parseFileLink(body: unknown): string | undefined {
  return fileLinkSchema.safeParse(body).data?.url;
}
