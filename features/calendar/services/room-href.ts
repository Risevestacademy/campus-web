import type { Route } from "next";

// The page that walks a member into a room. The code is ten letters and
// digits by the time it gets here, so it is safe in a path.
export function roomHref(code: string): Route {
  return `/join/${encodeURIComponent(code)}` as Route;
}
