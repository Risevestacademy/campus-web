"use client";

// Its own client module so a server component can hand the hook to the shell,
// which calls it: only exports of a "use client" file cross that boundary.
export { useUnreadNotificationCount as useUnreadNotifications } from "./hooks/use-notifications";
