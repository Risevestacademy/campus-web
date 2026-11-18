import { z } from "zod";

// A person's picture: one they uploaded, or the one Google gave. Only an
// https address is drawn; anything else is read as none, so the initial shows
// rather than the whole body failing.
export const avatarUrlSchema = z
  .url({ protocol: /^https$/ })
  .nullable()
  .catch(null);
