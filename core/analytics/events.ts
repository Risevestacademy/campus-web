import { z } from "zod";

import { cohortRoleSchema, systemRoleSchema } from "../api/schemas";
import { CLOSE_REASONS } from "../realtime/close-codes";
import { CLOSE_ACTIONS } from "../realtime/close-policy";
import { MOVE_CORRECTIONS } from "../realtime/move-outcomes";

export const ANALYTICS_EVENTS = {
  AUTH_LOGIN_FAILED: "auth.login_failed",
  AUTH_LOGIN_SUBMITTED: "auth.login_submitted",
  AUTH_LOGIN_SUCCEEDED: "auth.login_succeeded",
  AUTH_LOGOUT: "auth.logout",
  AUTH_PASSWORD_RESET_COMPLETED: "auth.password_reset_completed",
  AUTH_PASSWORD_RESET_REQUESTED: "auth.password_reset_requested",
  AUTH_SESSION_RENEWED: "auth.session_renewed",
  AUTH_SIGNUP_FAILED: "auth.signup_failed",
  AUTH_SIGNUP_SUBMITTED: "auth.signup_submitted",
  AUTH_SIGNUP_SUCCEEDED: "auth.signup_succeeded",
  AUTH_VERIFICATION_COMPLETED: "auth.verification_completed",
  AUTH_VERIFICATION_SENT: "auth.verification_sent",
  CAMPUS_CONNECTION_CHECK_COMPLETED: "campus.connection_check_completed",
  CAMPUS_PRESENCE_TAB_CONFLICT_SHOWN: "campus.presence_tab_conflict_shown",
  CAMPUS_PRESENCE_TAB_MOVED: "campus.presence_tab_moved",
  CAMPUS_PROXIMITY_AUDIO_READY: "campus.proximity_audio_ready",
  CAMPUS_PROXIMITY_VIEW_SHOWN: "campus.proximity_view_shown",
  CAMPUS_WORLD_CAMERA_ZOOMED: "campus_world.camera_zoomed",
  CAMPUS_WORLD_MAP_FAILED: "campus_world.map_failed",
  CAMPUS_WORLD_MAP_LOADED: "campus_world.map_loaded",
  CAMPUS_WORLD_MAP_READY: "campus_world.map_ready",
  CAMPUS_WORLD_MOVE_CORRECTED: "campus_world.move_corrected",
  COHORT_CREATED: "cohort.created",
  REALTIME_CLOSED: "realtime.closed",
  REALTIME_CONNECTED: "realtime.connected",
  REALTIME_GAVE_UP: "realtime.gave_up",
  REALTIME_RECONNECTED: "realtime.reconnected",
  IDENTITY_PROFILE_SETUP_COMPLETED: "identity.profile_setup_completed",
  IDENTITY_PROFILE_SETUP_STARTED: "identity.profile_setup_started",
} as const;

export type AnalyticsEventName =
  (typeof ANALYTICS_EVENTS)[keyof typeof ANALYTICS_EVENTS];

// Opaque IDs and short labels only: neither pattern admits "@", spaces, or a
// URL, so an email, a name, or a link cannot ride along in a free-text field.
const OPAQUE_ID_PATTERN = /^[\w-]{1,128}$/;
const LABEL_PATTERN = /^[\w.-]{1,128}$/;

const opaqueIdSchema = z.string().trim().regex(OPAQUE_ID_PATTERN);
const labelSchema = z.string().regex(LABEL_PATTERN);
const durationMsSchema = z.number().nonnegative();
const countSchema = z.number().int().nonnegative();
const roleSchema = z.enum([
  ...cohortRoleSchema.options,
  ...systemRoleSchema.options,
]);

const authMethodSchema = z.enum(["email", "google", "rise_sso"]);
const platformSchema = z.enum(["mobile", "web"]);
const presenceTabSurfaceSchema = z.enum(["pre_join", "taken_over"]);
const hearingSchema = z.enum(["proximity", "room"]);
const verificationTypeSchema = z.enum(["email", "invite", "phone"]);
const campusWorldMapErrorKindSchema = z.enum([
  "config",
  "layout",
  "manifest",
  "network",
  "render",
]);
const connectionCheckResultSchema = z.enum([
  "error",
  "failed",
  "passed",
  "rate_limited",
  "signed_out",
  "unavailable",
]);
const connectionCheckStepSchema = z.enum(["camera", "microphone", "network"]);
const realtimeCloseReasonSchema = z.enum([...CLOSE_REASONS, "unknown"]);
const realtimeCloseActionSchema = z.enum(CLOSE_ACTIONS);
const loginErrorCodeSchema = z.enum([
  "ACCOUNT_DISABLED",
  "ACCOUNT_NOT_FOUND",
  "EMAIL_NOT_VERIFIED",
  "INVALID_CREDENTIALS",
  "RATE_LIMITED",
  "SERVER_ERROR",
  "SESSION_EXPIRED",
]);
const signupErrorCodeSchema = z.enum([
  "EMAIL_ALREADY_EXISTS",
  "INVALID_ACCOUNT_DATA",
  "INVALID_INVITE",
  "RATE_LIMITED",
  "SERVER_ERROR",
]);

const placementSchema = z.object({
  cohort_id: opaqueIdSchema.optional(),
  role: roleSchema,
  track_id: opaqueIdSchema.optional(),
});

const connectionCheckCompletedSchema = z.object({
  failed_step: connectionCheckStepSchema.nullable(),
  result: connectionCheckResultSchema,
});

const campusWorldMapLoadedSchema = z.object({
  load_ms: durationMsSchema,
  map_id: labelSchema,
  tilesets: countSchema,
  version: labelSchema,
});

const campusWorldMapFailureSchema = z.object({
  error_kind: campusWorldMapErrorKindSchema,
  map_id: labelSchema.nullable(),
});

// Parsing strips every key a schema does not name, so these objects are the
// complete list of what may leave the app for PostHog.
export const analyticsEventSchemas = {
  [ANALYTICS_EVENTS.AUTH_LOGIN_SUBMITTED]: z.object({
    auth_method: authMethodSchema,
    entry_source: labelSchema.optional(),
    platform: platformSchema,
  }),
  [ANALYTICS_EVENTS.AUTH_LOGIN_SUCCEEDED]: placementSchema.extend({
    account_status: labelSchema.optional(),
    auth_method: authMethodSchema,
    user_id: opaqueIdSchema,
  }),
  [ANALYTICS_EVENTS.AUTH_LOGIN_FAILED]: z.object({
    auth_method: authMethodSchema,
    error_code: loginErrorCodeSchema,
  }),
  [ANALYTICS_EVENTS.AUTH_SIGNUP_SUBMITTED]: z.object({
    auth_method: authMethodSchema,
    platform: platformSchema,
  }),
  [ANALYTICS_EVENTS.AUTH_SIGNUP_SUCCEEDED]: z.object({
    auth_method: authMethodSchema,
    role: roleSchema,
    user_id: opaqueIdSchema,
  }),
  [ANALYTICS_EVENTS.AUTH_SIGNUP_FAILED]: z.object({
    auth_method: authMethodSchema,
    error_code: signupErrorCodeSchema,
  }),
  [ANALYTICS_EVENTS.AUTH_VERIFICATION_SENT]: z.object({
    verification_type: verificationTypeSchema,
  }),
  [ANALYTICS_EVENTS.AUTH_VERIFICATION_COMPLETED]: z.object({
    verification_type: verificationTypeSchema,
  }),
  [ANALYTICS_EVENTS.AUTH_PASSWORD_RESET_REQUESTED]: z.object({
    reset_method: z.enum(["email", "phone"]),
  }),
  [ANALYTICS_EVENTS.AUTH_PASSWORD_RESET_COMPLETED]: z.object({}),
  [ANALYTICS_EVENTS.AUTH_SESSION_RENEWED]: z.object({
    failed_attempts: countSchema,
    outcome: z.enum(["expired", "lapsed", "renewed"]),
  }),
  [ANALYTICS_EVENTS.AUTH_LOGOUT]: z.object({
    logout_source: z.enum(["admin_action", "session_expired", "user_action"]),
  }),
  [ANALYTICS_EVENTS.CAMPUS_CONNECTION_CHECK_COMPLETED]:
    connectionCheckCompletedSchema,
  [ANALYTICS_EVENTS.CAMPUS_PRESENCE_TAB_CONFLICT_SHOWN]: z.object({
    surface: presenceTabSurfaceSchema,
  }),
  [ANALYTICS_EVENTS.CAMPUS_PRESENCE_TAB_MOVED]: z.object({
    surface: presenceTabSurfaceSchema,
  }),
  [ANALYTICS_EVENTS.CAMPUS_PROXIMITY_AUDIO_READY]: z.object({
    first_audio_ms: durationMsSchema,
    hearing: hearingSchema,
  }),
  [ANALYTICS_EVENTS.CAMPUS_PROXIMITY_VIEW_SHOWN]: z.object({
    hearing: hearingSchema,
  }),
  [ANALYTICS_EVENTS.CAMPUS_WORLD_MAP_LOADED]: campusWorldMapLoadedSchema,
  [ANALYTICS_EVENTS.CAMPUS_WORLD_MAP_FAILED]: campusWorldMapFailureSchema,
  [ANALYTICS_EVENTS.CAMPUS_WORLD_MAP_READY]: z.object({
    first_frame_ms: durationMsSchema,
    map_id: labelSchema,
    version: labelSchema,
  }),
  [ANALYTICS_EVENTS.CAMPUS_WORLD_CAMERA_ZOOMED]: z.object({
    level: z.literal(["whole", 1, 2, 3]),
  }),
  [ANALYTICS_EVENTS.CAMPUS_WORLD_MOVE_CORRECTED]: z.object({
    outcome: z.enum([...MOVE_CORRECTIONS, "unknown"]),
  }),
  [ANALYTICS_EVENTS.COHORT_CREATED]: z.object({
    cohort_status: z.enum(["active", "completed", "upcoming"]),
  }),
  [ANALYTICS_EVENTS.IDENTITY_PROFILE_SETUP_STARTED]: placementSchema,
  [ANALYTICS_EVENTS.IDENTITY_PROFILE_SETUP_COMPLETED]: placementSchema,
  [ANALYTICS_EVENTS.REALTIME_CONNECTED]: z.object({
    reconnect: z.boolean(),
  }),
  [ANALYTICS_EVENTS.REALTIME_CLOSED]: z.object({
    action: realtimeCloseActionSchema,
    code: z.number().int().min(1000).max(4999),
    reason: realtimeCloseReasonSchema,
  }),
  [ANALYTICS_EVENTS.REALTIME_RECONNECTED]: z.object({ attempts: countSchema }),
  [ANALYTICS_EVENTS.REALTIME_GAVE_UP]: z.object({ attempts: countSchema }),
} satisfies Record<AnalyticsEventName, z.ZodObject>;

type EventProperties<Schema extends z.ZodObject> =
  keyof z.input<Schema> extends never ? Record<string, never> : z.input<Schema>;

export type AnalyticsEventMap = {
  [Name in AnalyticsEventName]: EventProperties<
    (typeof analyticsEventSchemas)[Name]
  >;
};

export const analyticsIdentitySchema = z.object({
  id: opaqueIdSchema,
  systemRole: systemRoleSchema,
});

export const analyticsCohortSchema = z.object({
  cohortId: opaqueIdSchema,
  cohortRole: cohortRoleSchema.optional(),
});

export type AnalyticsIdentity = Readonly<
  z.input<typeof analyticsIdentitySchema>
>;
export type AllowedAnalyticsIdentity = z.output<typeof analyticsIdentitySchema>;
export type AnalyticsCohort = Readonly<z.input<typeof analyticsCohortSchema>>;
export type AuthMethod = z.output<typeof authMethodSchema>;
export type AnalyticsPlatform = z.output<typeof platformSchema>;
export type PresenceTabSurface = z.output<typeof presenceTabSurfaceSchema>;
export type ConnectionCheckCompletedProperties = z.output<
  typeof connectionCheckCompletedSchema
>;
export type CampusWorldMapErrorKind = z.output<
  typeof campusWorldMapErrorKindSchema
>;
export type CampusWorldMapLoadedProperties = z.output<
  typeof campusWorldMapLoadedSchema
>;
export type CampusWorldMapFailureProperties = z.output<
  typeof campusWorldMapFailureSchema
>;
export type LoginErrorCode = z.output<typeof loginErrorCodeSchema>;
export type SignupErrorCode = z.output<typeof signupErrorCodeSchema>;

type IssueSummary = { code: string; path: string };

// Codes and paths only: an issue message can quote the rejected value.
function summarizeIssues(issues: z.ZodError["issues"]): IssueSummary[] {
  return issues.map(({ code, path }) => ({
    code,
    path: path.map(String).join("."),
  }));
}

function allow<Schema extends z.ZodType>(
  schema: Schema,
  value: unknown,
  subject: string,
): z.output<Schema> | undefined {
  const parsed = schema.safeParse(value);
  if (parsed.success) return parsed.data;

  console.error(
    `${subject} dropped: outside the analytics contract.`,
    summarizeIssues(parsed.error.issues),
  );
  return undefined;
}

export function allowAnalyticsProperties(
  eventName: AnalyticsEventName,
  properties: unknown,
): Record<string, unknown> | undefined {
  const schema: z.ZodObject = analyticsEventSchemas[eventName];
  return allow(schema, properties, `Analytics event ${eventName}`);
}

export function allowAnalyticsIdentity(
  identity: unknown,
): AllowedAnalyticsIdentity | undefined {
  return allow(analyticsIdentitySchema, identity, "Analytics identity");
}

export function allowAnalyticsCohort(cohort: unknown) {
  return allow(analyticsCohortSchema, cohort, "Analytics cohort");
}

export function allowDistinctId(distinctId: unknown): string | undefined {
  return allow(opaqueIdSchema, distinctId, "Analytics distinct ID");
}
