import type { ReactNode } from "react";

import ActiveCampusLayout from "@/app/campus/[id]/(media-session)/(active-campus)/layout";
import MediaSessionLayout from "@/app/campus/[id]/(media-session)/layout";

const params = Promise.resolve({ id: "c-1" });

// Layouts are async Server Components; RTL renders only what they resolve to.
// Pair with the route-access stub, since the layouts read the session.
export function mediaSessionLayout(children: ReactNode) {
  return MediaSessionLayout({ children, params });
}

export async function activeCampusLayout(children: ReactNode = <div />) {
  return mediaSessionLayout(await ActiveCampusLayout({ children, params }));
}
