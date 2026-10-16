export const INVITATION_PATH = "/invitation";
export const INVITE_TOKEN_COOKIE = "campus_invite_token";

// Set, deleted, and expired with exactly this pair: a cookie cleared on any
// other path stays in the browser.
export const INVITE_TOKEN_COOKIE_SCOPE = {
  name: INVITE_TOKEN_COOKIE,
  path: INVITATION_PATH,
} as const;
