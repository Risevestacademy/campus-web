import type { NextRequest } from "next/server";

import { guardCampusRequest } from "@/features/auth/proxy";

export function proxy(request: NextRequest) {
  return guardCampusRequest(request);
}

export const config = {
  matcher: ["/campus/:path*"],
};
