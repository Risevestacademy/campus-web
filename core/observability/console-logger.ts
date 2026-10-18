import type { Logger } from "./logger";

// The browser's Logger. Nothing collects a browser's console, so info records
// would only be noise in a member's devtools.
export function createConsoleLogger(): Logger {
  return {
    error: (event, fields) => console.error(event, fields),
    info: () => {},
    warn: (event, fields) => console.warn(event, fields),
  };
}
