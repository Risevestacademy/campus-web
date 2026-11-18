import { cookies } from "next/headers";

import { parseInviteToken } from "../schemas/invite-token.schema";
import { INVITE_TOKEN_COOKIE } from "./invite-token-cookie";

export async function readInviteToken(): Promise<string | undefined> {
  const cookieStore = await cookies();
  return parseInviteToken(cookieStore.get(INVITE_TOKEN_COOKIE)?.value);
}
