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
  CAMPUS_WORLD_MAP_FAILED: "campus_world.map_failed",
  CAMPUS_WORLD_MAP_LOADED: "campus_world.map_loaded",
  CAMPUS_WORLD_MAP_READY: "campus_world.map_ready",
  COHORT_CREATED: "cohort.created",
  IDENTITY_PROFILE_SETUP_COMPLETED: "identity.profile_setup_completed",
  IDENTITY_PROFILE_SETUP_STARTED: "identity.profile_setup_started",
} as const;

export type AnalyticsEventName =
  (typeof ANALYTICS_EVENTS)[keyof typeof ANALYTICS_EVENTS];

export type AnalyticsIdentity = Readonly<{
  accountStatus?: string;
  cohortId?: string;
  id: string;
  role: string;
  trackId?: string;
}>;

export type AuthMethod = "email" | "google" | "rise_sso";
export type AnalyticsPlatform = "mobile" | "web";
export type CampusWorldMapErrorKind =
  "config" | "layout" | "manifest" | "network" | "render";

export interface CampusWorldMapLoadedProperties {
  load_ms: number;
  map_id: string;
  tilesets: number;
  version: string;
}

export interface CampusWorldMapFailureProperties {
  error_kind: CampusWorldMapErrorKind;
  map_id: string | null;
}

export type LoginErrorCode =
  | "ACCOUNT_DISABLED"
  | "ACCOUNT_NOT_FOUND"
  | "EMAIL_NOT_VERIFIED"
  | "INVALID_CREDENTIALS"
  | "RATE_LIMITED"
  | "SERVER_ERROR"
  | "SESSION_EXPIRED";

export type SignupErrorCode =
  | "EMAIL_ALREADY_EXISTS"
  | "INVALID_ACCOUNT_DATA"
  | "INVALID_INVITE"
  | "RATE_LIMITED"
  | "SERVER_ERROR";

export interface AnalyticsEventMap {
  [ANALYTICS_EVENTS.AUTH_LOGIN_SUBMITTED]: {
    auth_method: AuthMethod;
    entry_source?: string;
    platform: AnalyticsPlatform;
  };
  [ANALYTICS_EVENTS.AUTH_LOGIN_SUCCEEDED]: {
    account_status?: string;
    auth_method: AuthMethod;
    cohort_id?: string;
    role: string;
    track_id?: string;
    user_id: string;
  };
  [ANALYTICS_EVENTS.AUTH_LOGIN_FAILED]: {
    auth_method: AuthMethod;
    error_code: LoginErrorCode;
  };
  [ANALYTICS_EVENTS.AUTH_SIGNUP_SUBMITTED]: {
    auth_method: AuthMethod;
    platform: AnalyticsPlatform;
  };
  [ANALYTICS_EVENTS.AUTH_SIGNUP_SUCCEEDED]: {
    auth_method: AuthMethod;
    role: string;
    user_id: string;
  };
  [ANALYTICS_EVENTS.AUTH_SIGNUP_FAILED]: {
    auth_method: AuthMethod;
    error_code: SignupErrorCode;
  };
  [ANALYTICS_EVENTS.AUTH_VERIFICATION_SENT]: {
    verification_type: "email" | "invite" | "phone";
  };
  [ANALYTICS_EVENTS.AUTH_VERIFICATION_COMPLETED]: {
    verification_type: "email" | "invite" | "phone";
  };
  [ANALYTICS_EVENTS.AUTH_PASSWORD_RESET_REQUESTED]: {
    reset_method: "email" | "phone";
  };
  [ANALYTICS_EVENTS.AUTH_PASSWORD_RESET_COMPLETED]: Record<string, never>;
  [ANALYTICS_EVENTS.AUTH_SESSION_RENEWED]: {
    failed_attempts: number;
    outcome: "expired" | "lapsed" | "renewed";
  };
  [ANALYTICS_EVENTS.AUTH_LOGOUT]: {
    logout_source: "admin_action" | "session_expired" | "user_action";
  };
  [ANALYTICS_EVENTS.CAMPUS_WORLD_MAP_LOADED]: CampusWorldMapLoadedProperties;
  [ANALYTICS_EVENTS.CAMPUS_WORLD_MAP_FAILED]: CampusWorldMapFailureProperties;
  [ANALYTICS_EVENTS.CAMPUS_WORLD_MAP_READY]: {
    first_frame_ms: number;
    map_id: string;
    version: string;
  };
  [ANALYTICS_EVENTS.COHORT_CREATED]: {
    cohort_status: "active" | "completed" | "upcoming";
  };
  [ANALYTICS_EVENTS.IDENTITY_PROFILE_SETUP_STARTED]: {
    cohort_id?: string;
    role: string;
    track_id?: string;
  };
  [ANALYTICS_EVENTS.IDENTITY_PROFILE_SETUP_COMPLETED]: {
    cohort_id?: string;
    role: string;
    track_id?: string;
  };
}
