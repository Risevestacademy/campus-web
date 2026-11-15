import type { PutFile } from "./types";

// XMLHttpRequest, not fetch: it reports upload progress in every browser.
export const putFile: PutFile = ({ file, headers, onProgress, signal, url }) =>
  new Promise((resolve) => {
    if (signal?.aborted) {
      resolve({ kind: "aborted" });
      return;
    }
    const request = new XMLHttpRequest();
    const abort = () => request.abort();

    request.open("PUT", url);
    for (const [name, value] of Object.entries(headers)) {
      request.setRequestHeader(name, value);
    }
    request.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable && event.total > 0) {
        onProgress?.(event.loaded / event.total);
      }
    });
    request.addEventListener("load", () => {
      signal?.removeEventListener("abort", abort);
      resolve({ kind: "answered", status: request.status });
    });
    request.addEventListener("error", () => {
      signal?.removeEventListener("abort", abort);
      resolve({ kind: "failed" });
    });
    request.addEventListener("abort", () => {
      signal?.removeEventListener("abort", abort);
      resolve({ kind: "aborted" });
    });
    signal?.addEventListener("abort", abort, { once: true });
    request.send(file);
  });
