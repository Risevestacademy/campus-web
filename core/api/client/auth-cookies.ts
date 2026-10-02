// Frontend-only marker set by the browser proxy after a successful refresh.
// Route authorization reads it to send a still-signed-out visitor to sign-in
// instead of looping back through /session/refresh. Never sent upstream.
export const REFRESH_ATTEMPTED_COOKIE = "campus_refresh_attempted";
