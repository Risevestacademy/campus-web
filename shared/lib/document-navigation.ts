// A full document load, not a router navigation: it drops the client state a
// soft navigation would keep (media session, query cache), and replaces the
// history entry so Back cannot return to it.
export function replaceDocument(href: string): void {
  window.location.replace(href);
}
