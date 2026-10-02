export interface paths {
  "/v1": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: operations["AppController_getHello"];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/v1/health": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /**
     * Health and performance check
     * @description Returns process status, uptime, memory, CPU and load averages.
     */
    get: operations["HealthController_check"];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/v1/auth/google": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /**
     * Start Google sign-in
     * @description Redirects to the Google consent screen and leaves a short-lived, httpOnly cookie behind so the callback can prove it reached the same browser. Open it as a top-level navigation, not with fetch.
     */
    get: operations["AuthController_start"];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/v1/auth/google/callback": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /**
     * Complete Google sign-in
     * @description Where Google returns the user. Verifies the request, resolves or creates the account behind the Google identity, and issues a session. Every outcome is a redirect into the web app, failures included.
     */
    get: operations["AuthController_callback"];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/v1/auth/me": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /**
     * Who is signed in
     * @description The session behind the cookie and the account it belongs to. The cookie is httpOnly, so this is how the web app learns whether anyone is signed in, and whether they belong in onboarding or the campus. Accepts either kind of session.
     */
    get: operations["AuthController_me"];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/v1/auth/refresh": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /**
     * Refresh the access session
     * @description Rotates both cookies and issues a new full-access session. The body says when the new tokens lapse, so the next refresh can be scheduled rather than guessed; the tokens themselves stay in the cookies.
     */
    post: operations["AuthController_refresh"];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/v1/auth/logout": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /**
     * Revoke the refresh session
     * @description Revokes the refresh cookie and clears both session cookies.
     */
    post: operations["AuthController_logout"];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/v1/invites": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /**
     * Create an invite (admin only)
     * @description Accepts { email, cohortId, cohortRole } for cohort invites — plus guestAccessExpiresAt when that role is guest — or { email, systemRole: admin } for admin invites. Stores only the SHA-256 hash in INVITES.token_hash and returns a one-time shareable link embedding the raw token. A second pending invite for the same email is rejected with 409 (revoke the open one first). expiresAt defaults to now + INVITE_TTL_DAYS and never exceeds it — nor the guest window, since a link must not stay redeemable past the visit it grants. Then emails the link to the invitee through Resend, when FF_EMAIL_ENABLED is on; emailStatus says how that went. A failed send still answers 201 — the invite exists, and inviteLink can be shared by hand.
     */
    post: operations["InvitesController_create"];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/v1/invites/preview": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /**
     * Preview an invite from its link, before signing in
     * @description Needs no session: the raw token from the invite link is the proof that the caller was sent it. Returns what the invitation screen shows — cohort, track, role, who sent it and the address it went to — and only while the invite is live, using the same codes as GET /v1/invites/validate-user-invite. A POST so the token travels in the body, which is not logged, rather than the URL, which is. Reads nothing that lets the caller act: accepting still takes a Google sign-in as the invited address.
     */
    post: operations["InvitesController_preview"];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/v1/invites/validate-user-invite": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /**
     * Validate the invite the signed-in account has to answer
     * @description For a provisional session, the invite it was issued for. For a full-access session — a member, who can be invited to another cohort — the pending invite addressed to the account. Confirms it is addressed to the signed-in account and returns it only while it is still live. Takes no body: the session identifies both the invite and the caller, so nobody can read someone else's offer. Returns 200 only for a live invite, so the decision screen can be rendered as-is. Not a re-send of the admin create-receipt: the token, the shareable link and mentorshipGroupId (no MENTORSHIP_GROUPS table) are withheld. The address under `invitee` is the signed-in account's own, read from its USERS row — the same string as the invited address, because the two must match to get this far. Note this read is not free of writes — a lapsed-but-still-pending invite has its status materialised here, which is what makes the following 403 truthful.
     */
    get: operations["InvitesController_validateUserInvite"];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/v1/invites/decision": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /**
     * Accept or decline the invite the signed-in account has
     * @description Answers the invite identified by the signed-in session and request. A provisional session already identifies the invite it was issued for, so `inviteId` may be omitted; when supplied, it must match the session. A full-access session (a member invited to another cohort) must supply the `inviteId` returned by validate-user-invite. This ensures the server answers the invite the member saw rather than a replacement created afterward. Accept enrols the invitee (or revives a membership they previously left) and applies the invite's systemRole; a provisional cookie is replaced with a full-access one. Decline closes the invite; a provisional cookie is cleared, leaving the account row in place. A full-access session keeps its cookies either way: accepting only adds a membership, which never shortens access. An invite that already carries an answer is a 409 — branch on error.code to decide where the caller goes next.
     */
    post: operations["InvitesController_decide"];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/v1/tracks": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /**
     * List tracks (admin only)
     * @description Every track in the catalogue, by name.
     */
    get: operations["TracksController_list"];
    put?: never;
    /**
     * Create a track (admin only)
     * @description Adds a programme to the catalogue. A track belongs to no cohort until it is attached to one with POST /v1/cohorts/{id}/tracks. code is trimmed and uppercased, and must be unique.
     */
    post: operations["TracksController_create"];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/v1/cohorts": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /**
     * List cohorts (admin only)
     * @description Every cohort, newest first. Tracks are on the detail route.
     */
    get: operations["CohortsController_list"];
    put?: never;
    /**
     * Create a cohort (admin only)
     * @description Creates an intake with no tracks; attach them with POST /v1/cohorts/{id}/tracks before inviting students, who each need a cohortTrackId. code is trimmed and uppercased, and must be unique. status defaults to upcoming.
     */
    post: operations["CohortsController_create"];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/v1/cohorts/{id}": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /**
     * Get a cohort with its tracks (admin only)
     * @description Each entry in tracks has the cohortTrackId (its id) a student invite to this cohort names.
     */
    get: operations["CohortsController_get"];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/v1/cohorts/{id}/tracks": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /**
     * Attach a track to a cohort (admin only)
     * @description Makes a catalogue track one this cohort runs. The response id is the cohortTrackId for student invites.
     */
    post: operations["CohortsController_attachTrack"];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
}
export type webhooks = Record<string, never>;
export interface components {
  schemas: {
    /**
     * @description Overall health state of the service.
     * @enum {string}
     */
    HealthStatus: "ok" | "degraded" | "unavailable";
    UptimeMetricsDto: {
      /**
       * @description Process uptime in seconds.
       * @example 86400.12
       */
      seconds: number;
    };
    MemoryMetricsDto: {
      /**
       * @description Total resident set size in bytes.
       * @example 123456789
       */
      rss: number;
      /**
       * @description Total size of the heap in bytes.
       * @example 98304000
       */
      heapTotal: number;
      /**
       * @description Heap actually used in bytes.
       * @example 61440000
       */
      heapUsed: number;
      /**
       * @description Memory used by C++ objects bound to JS in bytes.
       * @example 8912896
       */
      external: number;
    };
    CpuMetricsDto: {
      /**
       * @description Process CPU time in user mode (microseconds).
       * @example 823456
       */
      user: number;
      /**
       * @description Process CPU time in system mode (microseconds).
       * @example 123456
       */
      system: number;
      /**
       * @description Combined user+system CPU time (microseconds).
       * @example 946912
       */
      total: number;
    };
    LoadAverageDto: {
      /**
       * @description Load average over the last 1 minute.
       * @example 1.5
       */
      "1m": number;
      /**
       * @description Load average over the last 5 minutes.
       * @example 1.2
       */
      "5m": number;
      /**
       * @description Load average over the last 15 minutes.
       * @example 1.1
       */
      "15m": number;
    };
    HealthResponseDto: {
      /**
       * @description Overall health state of the service.
       * @example ok
       */
      status: components["schemas"]["HealthStatus"];
      /** @description Timestamp of the health check (ISO 8601). */
      timestamp: string;
      /** @description Process uptime. */
      uptime: components["schemas"]["UptimeMetricsDto"];
      /** @description Memory usage of the Node.js process. */
      memory: components["schemas"]["MemoryMetricsDto"];
      /** @description CPU time consumed by the Node.js process. */
      cpu: components["schemas"]["CpuMetricsDto"];
      /** @description System load average. */
      loadAverage: components["schemas"]["LoadAverageDto"];
    };
    /**
     * @description Machine-readable error code. Always one of the ExceptionCode enum.
     * @enum {string}
     */
    ExceptionCode:
      | "INVALID_ARGUMENT"
      | "UNAUTHORIZED"
      | "FORBIDDEN"
      | "NOT_FOUND"
      | "CONFLICT"
      | "INVITE_ALREADY_ACCEPTED"
      | "INVITE_ALREADY_DECLINED"
      | "INVITE_REVOKED"
      | "SPACE_AT_CAPACITY"
      | "INVITE_REQUIRED"
      | "ACCOUNT_SUSPENDED"
      | "RATE_LIMITED"
      | "INTERNAL_ERROR";
    ApiErrorBodyDto: {
      /**
       * @description Machine-readable error code. Always one of the ExceptionCode enum.
       * @example NOT_FOUND
       */
      code: components["schemas"]["ExceptionCode"];
      /**
       * @description Human-readable description of the error.
       * @example Resource not found
       */
      message: string;
      /** @description Optional structured context about the error (e.g. offending field). */
      details?: {
        [key: string]: unknown;
      };
    };
    ApiErrorResponseDto: {
      /** @description The error envelope. */
      error: components["schemas"]["ApiErrorBodyDto"];
    };
    /**
     * @description `full_access` belongs in the campus. `provisional` still has an invite to answer, and every route but onboarding refuses it.
     * @enum {string}
     */
    SessionScope: "provisional" | "full_access";
    /** @enum {string} */
    SystemRole: "user" | "admin";
    SessionUserDto: {
      /** @example 55555555-5555-4555-8555-555555555555 */
      id: string;
      /** @example ada@campus.local */
      email: string;
      /** @example Ada */
      firstName?: string | null;
      /** @example Lovelace */
      lastName?: string | null;
      /** @example Ada Lovelace */
      displayName?: string | null;
      /** @example https://lh3.googleusercontent.com/a/example */
      avatarUrl?: string | null;
      systemRole: components["schemas"]["SystemRole"];
    };
    /** @enum {string} */
    CohortRole: "student" | "professor" | "mentor" | "guest";
    SessionMembershipDto: {
      /** @example 11111111-1111-4111-8111-111111111111 */
      cohortId: string;
      role: components["schemas"]["CohortRole"];
    };
    SessionCohortDto: {
      /** @example Cohort 3 */
      name: string;
      /** @example C3 */
      code: string;
    };
    SessionCohortPlaceDto: {
      /** @example 11111111-1111-4111-8111-111111111111 */
      cohortId: string;
      role: components["schemas"]["CohortRole"];
      cohort: components["schemas"]["SessionCohortDto"];
    };
    SessionResponseDto: {
      /** @description `full_access` belongs in the campus. `provisional` still has an invite to answer, and every route but onboarding refuses it. */
      scope: components["schemas"]["SessionScope"];
      /**
       * Format: date-time
       * @description When the access token lapses. A full-access session renews it with POST /v1/auth/refresh; a provisional one has to sign in again.
       * @example 2026-09-30T12:15:00.000Z
       */
      expiresAt: string;
      /**
       * @description The invite to answer, if any: for a provisional session, the one it was issued for; for a full-access session, a pending invite to another cohort. Load it with GET /v1/invites/validate-user-invite.
       * @example 66666666-6666-4666-8666-666666666666
       */
      inviteId?: string | null;
      user: components["schemas"]["SessionUserDto"];
      /** @description The first of `memberships` — only one, so it cannot describe somebody in several cohorts; read `memberships` instead. Null for a provisional session, and for an admin who holds no cohort place. */
      membership?: components["schemas"]["SessionMembershipDto"] | null;
      /** @description Every cohort this account may enter, most recently joined first — a person can belong to several, in any mix of roles. Empty for a provisional session and for an admin with no cohort place. `membership` is the first entry, kept while clients move to this. */
      memberships: components["schemas"]["SessionCohortPlaceDto"][];
    };
    RefreshResponseDto: {
      /**
       * Format: date-time
       * @description When the new access token lapses. Refresh a little before this. It can be sooner than AUTH_SESSION_TTL_MINUTES: a guest whose visit ends first gets a token that ends with it.
       * @example 2026-09-30T12:15:00.000Z
       */
      expiresAt: string;
      /**
       * Format: date-time
       * @description When the new refresh token lapses. Past this, the user signs in again.
       * @example 2026-10-30T12:00:00.000Z
       */
      refreshExpiresAt: string;
    };
    CreateInviteDto: {
      /**
       * @description Invitee address. Stored lowercase.
       * @example new.student@campus.local
       */
      email: string;
      /**
       * @description Required for every invite but an admin one.
       * @example 11111111-1111-4111-8111-111111111111
       */
      cohortId?: string;
      /**
       * @description Required for every invite but an admin one.
       * @example student
       */
      cohortRole?: components["schemas"]["CohortRole"];
      /**
       * @description Required when cohortRole is student. Must belong to cohortId.
       * @example 22222222-2222-4222-8222-222222222222
       */
      cohortTrackId?: string;
      /**
       * @description Optional pod assignment. Requires cohortId.
       * @example 33333333-3333-4333-8333-333333333333
       */
      mentorshipGroupId?: string;
      /**
       * @description Defaults to 'user'. Admin invites pass 'admin' with no cohort fields.
       * @example user
       */
      systemRole?: components["schemas"]["SystemRole"];
      /**
       * @description Defaults to now + INVITE_TTL_DAYS. Must be in the future.
       * @example 2026-10-01T00:00:00.000Z
       */
      expiresAt?: string;
      /**
       * @description When the guest stops being one — required for cohortRole guest, and rejected for every other role. Not the same as expiresAt, which is how long this invite stays redeemable.
       * @example 2026-12-01T00:00:00.000Z
       */
      guestAccessExpiresAt?: string;
    };
    /** @enum {string} */
    InviteStatus: "pending" | "accepted" | "declined" | "revoked" | "expired";
    /**
     * @description `sent`: Resend accepted the email. `failed`: it was not confirmed sent — share inviteLink by hand; the invite exists either way. `disabled`: this deployment sends no email (FF_EMAIL_ENABLED off).
     * @enum {string}
     */
    InviteEmailStatus: "sent" | "failed" | "disabled";
    InviteResponseDto: {
      /** @example 44444444-4444-4444-8444-444444444444 */
      id: string;
      /** @example new.student@campus.local */
      email: string;
      /** @example 11111111-1111-4111-8111-111111111111 */
      cohortId?: Record<string, never>;
      cohortRole?: components["schemas"]["CohortRole"];
      /** @example 22222222-2222-4222-8222-222222222222 */
      cohortTrackId?: Record<string, never>;
      /** @example 33333333-3333-4333-8333-333333333333 */
      mentorshipGroupId?: Record<string, never>;
      systemRole: components["schemas"]["SystemRole"];
      status: components["schemas"]["InviteStatus"];
      /** @example 2026-09-29T12:00:00.000Z */
      expiresAt: string;
      /**
       * Format: date-time
       * @description Guest invites only; null otherwise. When the visit itself ends, which is not expiresAt above — that is how long the link stays redeemable, and it is clamped to never outlast this.
       * @example 2026-10-05T17:00:00.000Z
       */
      guestAccessExpiresAt?: string | null;
      /**
       * @description Shareable link embedding the RAW unhashed token. Shown exactly once — only the SHA-256 hash is stored in INVITES.token_hash.
       * @example http://localhost:3000/invitation?token=abc123
       */
      inviteLink: string;
      /**
       * @description Raw token. Never stored; only its hash lives in the DB.
       * @example abc123
       */
      token: string;
      /** @example 2026-09-22T12:00:00.000Z */
      createdAt: string;
      /**
       * @description `sent`: Resend accepted the email. `failed`: it was not confirmed sent — share inviteLink by hand; the invite exists either way. `disabled`: this deployment sends no email (FF_EMAIL_ENABLED off).
       * @example sent
       */
      emailStatus: components["schemas"]["InviteEmailStatus"];
    };
    InvitePreviewRequestDto: {
      /**
       * @description The `token` from the invite link, exactly as it arrived.
       * @example hFiA6EvJBOTvjt53b6SuvRAOCUiWl7umU4OWZl08WnU
       */
      token: string;
    };
    InvitePreviewCohortDto: {
      /** @example Product Design 2026 */
      name: string;
      /** @example PD26 */
      code: string;
      /** @example 2026-09-01 */
      startDate?: string | null;
      /** @example 2027-06-30 */
      endDate?: string | null;
    };
    InvitePreviewTrackDto: {
      /** @example Product Design */
      name: string;
      /** @example PD */
      code: string;
    };
    InvitePreviewInviterDto: {
      /** @example Jerry */
      firstName?: string | null;
      /** @example Smith */
      lastName?: string | null;
    };
    InvitePreviewResponseDto: {
      /**
       * @description The address the invite was sent to. Show it beside "Continue with Google": signing in with any other account is refused with invite_required.
       * @example ada@campus.local
       */
      email: string;
      /** @description Null for an admin invite, which joins no cohort. */
      cohort: components["schemas"]["InvitePreviewCohortDto"] | null;
      /** @description Set for students; null for every other role. */
      track: components["schemas"]["InvitePreviewTrackDto"] | null;
      /** @description Null for an admin invite — show systemRole instead. */
      cohortRole?: components["schemas"]["CohortRole"] | null;
      systemRole: components["schemas"]["SystemRole"];
      invitedBy: components["schemas"]["InvitePreviewInviterDto"];
      /**
       * Format: date-time
       * @description When the link stops working.
       * @example 2026-10-07T12:00:00.000Z
       */
      expiresAt: string;
      /**
       * Format: date-time
       * @description Guests only: when the visit being offered ends. Say so before they accept.
       * @example null
       */
      guestAccessExpiresAt?: string | null;
    };
    /** @enum {string} */
    CohortStatus: "upcoming" | "active" | "completed";
    InviteCohortDto: {
      /** @example 11111111-1111-4111-8111-111111111111 */
      id: string;
      /** @example Cohort 1 */
      name: string;
      /** @example C1 */
      code: string;
      /** @example 2026-09-01 */
      startDate?: string | null;
      /** @example 2027-06-30 */
      endDate?: string | null;
      status: components["schemas"]["CohortStatus"];
      /**
       * Format: date-time
       * @example 2026-09-22T12:00:00.000Z
       */
      createdAt: string;
      /**
       * Format: date-time
       * @example 2026-09-22T12:00:00.000Z
       */
      updatedAt: string;
    };
    InviteCohortTrackDto: {
      /** @example 22222222-2222-4222-8222-222222222222 */
      id: string;
      /** @example 11111111-1111-4111-8111-111111111111 */
      cohortId: string;
      /** @example 33333333-3333-4333-8333-333333333333 */
      trackId: string;
      /**
       * Format: date-time
       * @example 2026-09-22T12:00:00.000Z
       */
      createdAt: string;
    };
    InviteTrackDto: {
      /** @example 33333333-3333-4333-8333-333333333333 */
      id: string;
      /** @example Software Engineering */
      name: string;
      /** @example SE */
      code: string;
      /** @example Backend and infra */
      description?: string | null;
      /**
       * Format: date-time
       * @example 2026-09-22T12:00:00.000Z
       */
      createdAt: string;
      /**
       * Format: date-time
       * @example 2026-09-22T12:00:00.000Z
       */
      updatedAt: string;
    };
    InvitedByDto: {
      /** @example 44444444-4444-4444-8444-444444444444 */
      id: string;
      /** @example Ada */
      firstName?: string | null;
      /** @example Lovelace */
      lastName?: string | null;
    };
    /** @enum {string} */
    UserStatus: "active" | "suspended";
    InviteInviteeDto: {
      /** @example 55555555-5555-4555-8555-555555555555 */
      id: string;
      /** @example new.student@campus.local */
      email: string;
      /** @example New */
      firstName?: string | null;
      /** @example Student */
      lastName?: string | null;
      /** @example New Student */
      displayName?: string | null;
      systemRole: components["schemas"]["SystemRole"];
      status: components["schemas"]["UserStatus"];
      /**
       * Format: date-time
       * @example 2026-09-22T12:00:00.000Z
       */
      createdAt: string;
    };
    InviteOnboardingResponseDto: {
      /** @example 66666666-6666-4666-8666-666666666666 */
      id: string;
      cohort: components["schemas"]["InviteCohortDto"] | null;
      cohortTrack: components["schemas"]["InviteCohortTrackDto"] | null;
      track: components["schemas"]["InviteTrackDto"] | null;
      cohortRole?: components["schemas"]["CohortRole"] | null;
      systemRole: components["schemas"]["SystemRole"];
      status: components["schemas"]["InviteStatus"];
      /**
       * Format: date-time
       * @description When the offer lapses. Not a deadline on the user, but the boundary at which this endpoint starts answering 403.
       * @example 2026-09-29T12:00:00.000Z
       */
      expiresAt: string;
      /**
       * Format: date-time
       * @description Guest invites only; null otherwise. When the access being offered ends — the decision screen should say so before anyone accepts, since a guest is agreeing to a visit rather than a place.
       * @example null
       */
      guestAccessExpiresAt?: string | null;
      invitedBy: components["schemas"]["InvitedByDto"];
      /**
       * Format: date-time
       * @example 2026-09-22T12:00:00.000Z
       */
      createdAt: string;
      user: components["schemas"]["InviteInviteeDto"];
    };
    /**
     * @description Accept admits the invitee: cohort membership is created and the session is upgraded to full access. Decline closes the invite and ends the provisional session.
     * @enum {string}
     */
    InviteDecision: "accept" | "decline";
    InviteDecisionDto: {
      /** @description Accept admits the invitee: cohort membership is created and the session is upgraded to full access. Decline closes the invite and ends the provisional session. */
      decision: components["schemas"]["InviteDecision"];
      /**
       * @description The invite being answered — the id GET /v1/invites/validate-user-invite returned. Required for a full-access session (a member invited to another cohort), so an invite replaced since the member read it is never accepted unseen. A provisional session may omit it; its session already names the invite, and an id that differs is refused.
       * @example 66666666-6666-4666-8666-666666666666
       */
      inviteId?: string;
    };
    /** @enum {string} */
    InviteDecisionStatus: "accepted" | "declined";
    /** @enum {string} */
    StudentStatus:
      "active" | "dismissed" | "graduated" | "withdrawn" | "deferred";
    MembershipGrantedDto: {
      /** @example 11111111-1111-4111-8111-111111111111 */
      cohortId: string;
      role: components["schemas"]["CohortRole"];
      /** @example null */
      cohortTrackId?: string | null;
      status?: components["schemas"]["StudentStatus"] | null;
      /**
       * Format: date-time
       * @example 2026-09-22T12:00:00.000Z
       */
      joinedAt: string;
      /**
       * Format: date-time
       * @description When this membership stops counting. Set for guests and null for everyone else, so a client can tell a visitor they are here until a date rather than indefinitely.
       * @example null
       */
      accessExpiresAt?: string | null;
    };
    InviteDecisionResponseDto: {
      /** @example 66666666-6666-4666-8666-666666666666 */
      inviteId: string;
      status: components["schemas"]["InviteDecisionStatus"];
      /**
       * Format: date-time
       * @example 2026-09-22T12:00:00.000Z
       */
      decidedAt: string;
      /** @description Null for a cohort-less admin invite, and for a decline. */
      membership?: components["schemas"]["MembershipGrantedDto"] | null;
      /** @description The account's role after accepting — the invite is the only channel that can grant anything above the default a provisional sign-in gets. Null on decline. */
      systemRole?: components["schemas"]["SystemRole"] | null;
    };
    CreateTrackDto: {
      /** @example Software Engineering */
      name: string;
      /**
       * @description Unique across tracks. Stored uppercase.
       * @example SE
       */
      code: string;
      /** @example Backend and infra */
      description?: string;
    };
    TrackResponseDto: {
      /** @example 33333333-3333-4333-8333-333333333333 */
      id: string;
      /** @example Software Engineering */
      name: string;
      /** @example SE */
      code: string;
      /** @example Backend and infra */
      description: string | null;
      /**
       * Format: date-time
       * @example 2026-09-22T12:00:00.000Z
       */
      createdAt: string;
      /**
       * Format: date-time
       * @example 2026-09-22T12:00:00.000Z
       */
      updatedAt: string;
    };
    PaginationMetaDto: {
      /**
       * @description Current page number (1-based).
       * @example 1
       */
      page: number;
      /**
       * @description Number of items per page.
       * @example 20
       */
      perPage: number;
      /**
       * @description Total number of items across all pages.
       * @example 152
       */
      total: number;
      /**
       * @description Total number of pages.
       * @example 8
       */
      totalPages: number;
    };
    PaginatedResponseDto: {
      /** @description The page of items. */
      items: string[];
      /** @description Pagination metadata. */
      meta: components["schemas"]["PaginationMetaDto"];
    };
    CreateCohortDto: {
      /** @example Cohort 1 */
      name: string;
      /**
       * @description Unique across cohorts. Stored uppercase.
       * @example C1
       */
      code: string;
      /**
       * Format: date
       * @example 2026-09-01
       */
      startDate?: string;
      /**
       * Format: date
       * @description On or after startDate.
       * @example 2027-06-30
       */
      endDate?: string;
      /** @default upcoming */
      status: components["schemas"]["CohortStatus"];
    };
    CohortResponseDto: {
      /** @example 11111111-1111-4111-8111-111111111111 */
      id: string;
      /** @example Cohort 1 */
      name: string;
      /** @example C1 */
      code: string;
      /**
       * Format: date
       * @example 2026-09-01
       */
      startDate: string | null;
      /**
       * Format: date
       * @example 2027-06-30
       */
      endDate: string | null;
      status: components["schemas"]["CohortStatus"];
      /**
       * Format: date-time
       * @example 2026-09-22T12:00:00.000Z
       */
      createdAt: string;
      /**
       * Format: date-time
       * @example 2026-09-22T12:00:00.000Z
       */
      updatedAt: string;
    };
    CohortTrackResponseDto: {
      /**
       * @description The cohortTrackId to put on a student invite.
       * @example 22222222-2222-4222-8222-222222222222
       */
      id: string;
      /** @example 11111111-1111-4111-8111-111111111111 */
      cohortId: string;
      track: components["schemas"]["TrackResponseDto"];
      /**
       * Format: date-time
       * @example 2026-09-22T12:00:00.000Z
       */
      createdAt: string;
    };
    CohortDetailResponseDto: {
      /** @example 11111111-1111-4111-8111-111111111111 */
      id: string;
      /** @example Cohort 1 */
      name: string;
      /** @example C1 */
      code: string;
      /**
       * Format: date
       * @example 2026-09-01
       */
      startDate: string | null;
      /**
       * Format: date
       * @example 2027-06-30
       */
      endDate: string | null;
      status: components["schemas"]["CohortStatus"];
      /**
       * Format: date-time
       * @example 2026-09-22T12:00:00.000Z
       */
      createdAt: string;
      /**
       * Format: date-time
       * @example 2026-09-22T12:00:00.000Z
       */
      updatedAt: string;
      /** @description The tracks this cohort runs, by track name. */
      tracks: components["schemas"]["CohortTrackResponseDto"][];
    };
    AttachTrackDto: {
      /**
       * @description A track from GET /v1/tracks.
       * @example 33333333-3333-4333-8333-333333333333
       */
      trackId: string;
    };
  };
  responses: never;
  parameters: never;
  requestBodies: never;
  headers: never;
  pathItems: never;
}
export type $defs = Record<string, never>;
export interface operations {
  AppController_getHello: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content?: never;
      };
    };
  };
  HealthController_check: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description The service is healthy. */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["HealthResponseDto"];
        };
      };
      /** @description The service failed to produce a health check. */
      500: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorResponseDto"];
        };
      };
    };
  };
  AuthController_start: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description Redirect to Google. */
      302: {
        headers: {
          [name: string]: unknown;
        };
        content?: never;
      };
    };
  };
  AuthController_callback: {
    parameters: {
      query?: {
        /** @description One-time authorization code to exchange with Google. */
        code?: string;
        /** @description The signed state issued when the sign-in started. */
        state?: string;
        /** @description Set when the user declined at the Google consent screen. */
        error?: string;
      };
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description On success, sets the session cookie and redirects to /invitation when an invite is still to be answered — including for somebody already a member, invited to another cohort — otherwise to /campus. On failure, redirects to /sign-in?error=<code>, where code is one of invite_required, account_suspended, denied, invalid_state, expired_state, missing_code, exchange_failed, unverified_email, incomplete_profile, invalid_request, rate_limited, server_error. */
      302: {
        headers: {
          [name: string]: unknown;
        };
        content?: never;
      };
      /** @description Google sign-in is switched off on this deployment. */
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorResponseDto"];
        };
      };
    };
  };
  AuthController_me: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["SessionResponseDto"];
        };
      };
      /** @description No usable session. For a full-access session, try POST /v1/auth/refresh once before sending the user to sign in. */
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorResponseDto"];
        };
      };
    };
  };
  AuthController_refresh: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["RefreshResponseDto"];
        };
      };
      /** @description The refresh token is missing, spent, revoked or expired, or the account no longer has access. Send the user to sign in. */
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorResponseDto"];
        };
      };
    };
  };
  AuthController_logout: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      204: {
        headers: {
          [name: string]: unknown;
        };
        content?: never;
      };
    };
  };
  InvitesController_create: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody: {
      content: {
        "application/json": components["schemas"]["CreateInviteDto"];
      };
    };
    responses: {
      201: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["InviteResponseDto"];
        };
      };
      /** @description A malformed body, or a shape the INVITES CHECK constraints would reject. Mirrored in InvitesService.assertValidShape so the caller sees which pairing rule was broken rather than a constraint name. Note that { email } alone is no longer accepted: every invite but an admin one names a cohort, since an invite naming neither accepts into nothing. */
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorResponseDto"];
        };
      };
      /** @description No usable session. Three distinct causes, all refused the same way: the cookie is absent or unparseable, the account behind it no longer exists, or the account is suspended. Suspension is a 401 rather than a 403 because it is decided by SessionGuard, before authorization is reached. A provisional session cannot get here either — the scope check fails first. */
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorResponseDto"];
        };
      };
      /** @description Authenticated but not an admin. Note that a suspended account is NOT a 403 here: SessionGuard rejects it with 401 ACCOUNT_SUSPENDED before AdminGuard ever runs, so 403 means exactly one thing on this route. A provisional session is likewise refused as 401 by the scope check. */
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorResponseDto"];
        };
      };
      /** @description A referenced cohort or cohort track does not exist. A track that exists but belongs to a different cohort is a 400 instead — the reference is well-formed, it is just the wrong pairing. */
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorResponseDto"];
        };
      };
      /** @description A pending invite already exists for this address, enforced by the partial unique index invites_email_pending_unique. The open invite must be revoked or allowed to lapse first — it is never reused or rotated, since a link the first recipient still holds would stop working. Also refused: an invite to a cohort the address is already a live member of, which could never be accepted. Membership of other cohorts is no obstacle, and nor is one that has ended. */
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorResponseDto"];
        };
      };
    };
  };
  InvitesController_preview: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody: {
      content: {
        "application/json": components["schemas"]["InvitePreviewRequestDto"];
      };
    };
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["InvitePreviewResponseDto"];
        };
      };
      /** @description FORBIDDEN: the invite has expired. */
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorResponseDto"];
        };
      };
      /** @description No invite matches this token — mistyped or truncated. */
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorResponseDto"];
        };
      };
      /** @description INVITE_ALREADY_ACCEPTED (send them to sign in), INVITE_ALREADY_DECLINED, or INVITE_REVOKED. */
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorResponseDto"];
        };
      };
    };
  };
  InvitesController_validateUserInvite: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["InviteOnboardingResponseDto"];
        };
      };
      /** @description No usable session. */
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorResponseDto"];
        };
      };
      /** @description The invite was still pending but its expiresAt has passed. The status is materialised to expired before this is thrown, so the same request replayed a moment later answers 409 rather than 403 — a lapsed invite is a state that resolves, and the row is left consistent with it. */
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorResponseDto"];
        };
      };
      /** @description The session carries an inviteId but no such invite exists, the provisional session has no inviteId at all, or a full-access session has no pending invite addressed to it. All three mean there is nothing here to answer. */
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorResponseDto"];
        };
      };
      /** @description The invite reached a terminal state — accepted, declined or revoked — so there is no decision left to make. Distinct from the 403 above: that one was live and ran out of time, this one was resolved by somebody. Retrying cannot change the answer. error.code names which answer stands (INVITE_ALREADY_ACCEPTED, INVITE_ALREADY_DECLINED, INVITE_REVOKED) and is the same on the decision route, so a caller that validates before deciding sees one vocabulary. */
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorResponseDto"];
        };
      };
    };
  };
  InvitesController_decide: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody: {
      content: {
        "application/json": components["schemas"]["InviteDecisionDto"];
      };
    };
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["InviteDecisionResponseDto"];
        };
      };
      /** @description The body is not one of the two decisions (an absent or empty body reports the same way), or a full-access session did not name the invite it is answering in `inviteId`. */
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorResponseDto"];
        };
      };
      /** @description No usable session. A suspended account is a 401 rather than a 403 because the guard rejects it before the route runs. */
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorResponseDto"];
        };
      };
      /** @description The invite lapsed before it was answered. Applies to decline as well as accept: an expired offer cannot be turned down either. The same 403 comes back whether or not the expiry has already been materialised by a read, so the code does not depend on what the caller did earlier. */
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorResponseDto"];
        };
      };
      /** @description A provisional session names no invite or one that does not exist, or a full-access caller names an invite that does not exist or is addressed to another account. All mean there is nothing here to decide. */
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorResponseDto"];
        };
      };
      /** @description The invite already carries an answer, so there is nothing to decide. Branch on error.code, not on the 409: INVITE_ALREADY_ACCEPTED means the offer was taken, so send the caller back through sign-in to pick up the membership. INVITE_ALREADY_DECLINED and INVITE_REVOKED both mean the offer is closed — leave the flow. A plain CONFLICT is a different thing: the invite is still live, but the account already holds a standing membership of that cohort which an invite must not overwrite, so it stays pending for an admin to resolve. details.status repeats the same fact for logging. Re-sending the same decision is never the recovery: a lost response is indistinguishable from a deliberate second answer, and treating them alike would let a retry reopen an invite that was already settled. The validation route reports the same codes for the same states. */
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorResponseDto"];
        };
      };
    };
  };
  TracksController_list: {
    parameters: {
      query?: {
        /** @description Page to fetch, 1-based. */
        page?: number;
        /** @description Number of items per page. */
        perPage?: number;
      };
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description Paginated list. */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["PaginatedResponseDto"] & {
            items?: components["schemas"]["TrackResponseDto"][];
          };
        };
      };
      /** @description No usable session: none sent, unparseable, expired, provisional, or its account is gone or suspended. */
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorResponseDto"];
        };
      };
      /** @description Signed in, but not an admin. */
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorResponseDto"];
        };
      };
    };
  };
  TracksController_create: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody: {
      content: {
        "application/json": components["schemas"]["CreateTrackDto"];
      };
    };
    responses: {
      201: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["TrackResponseDto"];
        };
      };
      /** @description A missing or malformed field. */
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorResponseDto"];
        };
      };
      /** @description No usable session: none sent, unparseable, expired, provisional, or its account is gone or suspended. */
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorResponseDto"];
        };
      };
      /** @description Signed in, but not an admin. */
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorResponseDto"];
        };
      };
      /** @description Another track already has this code. */
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorResponseDto"];
        };
      };
    };
  };
  CohortsController_list: {
    parameters: {
      query?: {
        /** @description Page to fetch, 1-based. */
        page?: number;
        /** @description Number of items per page. */
        perPage?: number;
      };
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description Paginated list. */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["PaginatedResponseDto"] & {
            items?: components["schemas"]["CohortResponseDto"][];
          };
        };
      };
      /** @description No usable session: none sent, unparseable, expired, provisional, or its account is gone or suspended. */
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorResponseDto"];
        };
      };
      /** @description Signed in, but not an admin. */
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorResponseDto"];
        };
      };
    };
  };
  CohortsController_create: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody: {
      content: {
        "application/json": components["schemas"]["CreateCohortDto"];
      };
    };
    responses: {
      201: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["CohortResponseDto"];
        };
      };
      /** @description A missing or malformed field, or an endDate before startDate. */
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorResponseDto"];
        };
      };
      /** @description No usable session: none sent, unparseable, expired, provisional, or its account is gone or suspended. */
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorResponseDto"];
        };
      };
      /** @description Signed in, but not an admin. */
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorResponseDto"];
        };
      };
      /** @description Another cohort already has this code. */
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorResponseDto"];
        };
      };
    };
  };
  CohortsController_get: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        id: string;
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["CohortDetailResponseDto"];
        };
      };
      /** @description id is not a UUID. */
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorResponseDto"];
        };
      };
      /** @description No usable session: none sent, unparseable, expired, provisional, or its account is gone or suspended. */
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorResponseDto"];
        };
      };
      /** @description Signed in, but not an admin. */
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorResponseDto"];
        };
      };
      /** @description No cohort has this id. */
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorResponseDto"];
        };
      };
    };
  };
  CohortsController_attachTrack: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        id: string;
      };
      cookie?: never;
    };
    requestBody: {
      content: {
        "application/json": components["schemas"]["AttachTrackDto"];
      };
    };
    responses: {
      201: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["CohortTrackResponseDto"];
        };
      };
      /** @description id or trackId is not a UUID. */
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorResponseDto"];
        };
      };
      /** @description No usable session: none sent, unparseable, expired, provisional, or its account is gone or suspended. */
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorResponseDto"];
        };
      };
      /** @description Signed in, but not an admin. */
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorResponseDto"];
        };
      };
      /** @description The cohort or the track does not exist. */
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorResponseDto"];
        };
      };
      /** @description The cohort already runs this track. */
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorResponseDto"];
        };
      };
    };
  };
}
