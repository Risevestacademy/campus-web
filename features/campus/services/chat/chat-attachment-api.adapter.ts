import type { ApiClient } from "@/core/api/client";
import type { ChatAttachment } from "@/core/realtime";

import { parseAttachedFile, parseFileLink } from "./chat-attachment.schema";

export type AttachProblem =
  "signed-out" | "not-allowed" | "no-call" | "not-sent" | "unavailable";

export type AttachResult =
  | { kind: "attached"; attachment: ChatAttachment }
  | { kind: "problem"; problem: AttachProblem };

// 404 is a space that is not there, or an upload of the member's that is not
// waiting; 422 is a file that is not what its upload was signed for. Either
// way the file did not arrive whole, and uploading it again is the way on.
const attachProblems: Record<number, AttachProblem> = {
  401: "signed-out",
  403: "not-allowed",
  404: "not-sent",
  409: "no-call",
  422: "not-sent",
};

// Ties an uploaded file to the call going on in the space, so the people there
// can open it until the call ends. Nothing throws.
export async function attachToCall(
  api: ApiClient,
  {
    cohortId,
    mediaId,
    spaceId,
  }: { cohortId: string; mediaId: string; spaceId: string },
): Promise<AttachResult> {
  try {
    const { data, response } = await api.POST(
      "/v1/cohorts/{cohortId}/spaces/{spaceId}/call/attachments",
      { params: { path: { cohortId, spaceId } }, body: { mediaId } },
    );
    if (!response.ok) {
      return {
        kind: "problem",
        problem: attachProblems[response.status] ?? "unavailable",
      };
    }
    const attachment = parseAttachedFile(data);
    return attachment
      ? { kind: "attached", attachment }
      : { kind: "problem", problem: "unavailable" };
  } catch {
    return { kind: "problem", problem: "unavailable" };
  }
}

export type FileLinkProblem = "signed-out" | "gone" | "unavailable";

export type FileLinkResult =
  { kind: "link"; url: string } | { kind: "problem"; problem: FileLinkProblem };

// A fresh link to a file sent in a call's chat. It lasts fifteen minutes, so it
// is asked for when the member opens the file and never kept. 410 means the
// call ended and the file was let go. Nothing throws.
export async function readFileLink(
  api: ApiClient,
  mediaId: string,
): Promise<FileLinkResult> {
  try {
    const { data, response } = await api.GET("/v1/media/{id}/url", {
      params: { path: { id: mediaId } },
    });
    if (response.status === 401) {
      return { kind: "problem", problem: "signed-out" };
    }
    if (response.status === 410) return { kind: "problem", problem: "gone" };
    const url = response.ok ? parseFileLink(data) : undefined;
    return url
      ? { kind: "link", url }
      : { kind: "problem", problem: "unavailable" };
  } catch {
    return { kind: "problem", problem: "unavailable" };
  }
}
