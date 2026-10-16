import type { NextRequest } from "next/server";

import { guardCampusRequest } from "@/features/auth/proxy";
import {
  INVITATION_PATH,
  moveInviteTokenToCookie,
} from "@/features/invitation/proxy";

export function proxy(request: NextRequest) {
  return request.nextUrl.pathname === INVITATION_PATH
    ? moveInviteTokenToCookie(request)
    : guardCampusRequest(request);
}

export const config = {
  matcher: ["/campus/:path*", "/invitation"],
};
