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
  "/v1/auth/google/token": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /**
     * Sign in from a native app
     * @description For a client that cannot keep cookies. The app signs the user in with Google's own SDK and posts the id_token it receives; the API makes the same decision the browser callback makes and answers with the session in the body instead of a redirect and cookies. Send `accessToken` as a bearer token from then on, and keep `refreshToken` for POST /v1/auth/refresh. `inviteId` set means there is an invite to answer first.
     */
    post: operations["AuthController_tokenSignIn"];
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
     * @description Rotates both cookies and issues a new full-access session. The body says when the new tokens lapse, so the next refresh can be scheduled rather than guessed; the tokens themselves stay in the cookies. A client that holds its own tokens sends `refreshToken` in the body instead, and gets the new pair back in the body with no cookies set.
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
     * @description Revokes the refresh cookie and clears both session cookies. A client that holds its own tokens sends `refreshToken` in the body instead.
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
    /**
     * List invites
     * @description Every invite the system has, newest first, paginated. Filter with `status` — `pending` for the open offers, `revoked` to see who cancelled what — and narrow to one intake with `cohortId`, `trackId`, or both.
     *
     *     This is the only place a revoked invite stays visible: sign-in cannot find one, so without this route "who revoked that address" would have no answer at all.
     *
     *     Deliberately not the same shape as POST /v1/invites. That one returns the raw token and shareable link, because the token is shown exactly once and is unrecoverable afterwards. Listing would hand every unredeemed token in the system to any admin who asked for page 1, so these rows carry ids and audit fields only.
     */
    get: operations["InvitesController_list"];
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
  "/v1/invites/import": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /**
     * Invite a cohort from a CSV file (admin only)
     * @description Uploads one file and creates one invite per row, all to the cohort named in `cohortId`. Each row is an ordinary invite, held to the same rules as POST /v1/invites and emailed the same way.
     *
     *     **The file.** UTF-8, comma-separated, with a header row. Up to 500 rows and 256 KB.
     *
     *     | Column | Required | Value |
     *     | --- | --- | --- |
     *     | `email` | yes | The address to invite |
     *     | `role` | yes | `student`, `professor`, `mentor` or `guest` |
     *     | `track` | for students | A track code the cohort runs, e.g. `SE` |
     *     | `visit_ends` | for guests | When the visit ends, e.g. `2026-11-30T17:00:00Z` |
     *
     *     Columns may come in any order, and other columns are ignored.
     *
     *     **The answer.** Always 200 once the file can be read, with one entry per row saying whether it was invited or why it was not. A row that fails does not stop the others: fix it and upload the file again, and the rows already invited are refused the second time as already invited.
     *
     *     Each invited row carries its `inviteLink`, shown this once, and `emailStatus`. Share the link by hand where the email did not go.
     *
     *     A file that cannot be read as a list of invites at all — empty, no header, a required column missing, too many rows — is a 400 and invites nobody.
     */
    post: operations["InvitesController_importCsv"];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/v1/invites/{id}/revoke": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /**
     * Revoke a pending invite
     * @description Cancels an offer you no longer want to honour, recording which admin did it and when. This is the step POST /v1/invites asks for before re-inviting an address: only one pending invite per address is allowed, and revoking is what frees the slot.
     *
     *     Only a live pending invite can be revoked. One already accepted, declined or revoked answers with the same 409 code the invitee would get for trying to redeem it, so a settled invite has one answer whichever side asks. Revoking twice is a 409 rather than a silent success.
     *
     *     An invite that has lapsed cannot be revoked — it has already stopped on its own, so there is no cancellation to record. It answers 403 INVITE_EXPIRED, and its status is materialised as expired.
     *
     *     Afterwards the invitee can no longer sign in with it. Somebody part way through onboarding gets INVITE_REVOKED (409) on their next call — unless they have been invited again, in which case validate-user-invite shows them the new invite and a decision naming it is accepted.
     */
    post: operations["InvitesController_revoke"];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/v1/invites/{id}/resend": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /**
     * Resend an invite with a new link
     * @description For an invite whose email never arrived, or whose link ran out before anybody used it. Generates a new token, emails the new link, and returns the same receipt as POST /v1/invites, so the link can still be shared by hand if the email fails again.
     *
     *     The old link stops working at once. Only the hash of a token is stored, so the original link cannot be sent a second time.
     *
     *     Works on a pending or an expired invite, and leaves it pending for as long again as it was created to last: the default window, or the shorter one its `expiresAt` set. For a guest, never past the end of the visit.
     *
     *     Resending an expired invite offers it again, so it is checked as a new invite would be and answers 409 CONFLICT when the address already holds another pending invite, the person has joined the cohort since, or the guest visit it offered is over.
     *
     *     An accepted, declined or revoked invite is refused with the 409 code every other route gives it.
     *
     *     Each resend is recorded in the audit log with the admin who did it.
     */
    post: operations["InvitesController_resend"];
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
  "/v1/invites/flag": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /**
     * Flag a mistake on the invite the signed-in account has
     * @description For the invitee who can see the offer is wrong — the role, the track, the cohort — to say so before answering. The message is recorded on the invite and emailed to the admin who sent it; every admin can find it with GET /v1/invites?flagged=true.
     *
     *     A flag is a note, not an answer. The invite stays pending and POST /v1/invites/decision works exactly as before, so the invitee can flag and still accept. Correcting the offer is the admin’s move: revoke it and send another.
     *
     *     Which invite is flagged follows the rule the decision route uses: a provisional session flags its own unless `inviteId` names the live replacement, and a full-access session must name it.
     *
     *     One flag per invite. A second is a 409 CONFLICT, and validate-user-invite reports `flaggedAt` so the screen can show that it has already been sent. No cookie is set or cleared.
     */
    post: operations["InvitesController_flag"];
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
     * @description Answers the invite identified by the signed-in session and request. A provisional session already identifies the invite it was issued for, so `inviteId` may be omitted; when supplied, it must match the session. A full-access session (a member invited to another cohort) must supply the `inviteId` returned by validate-user-invite. This ensures the server answers the invite the member saw rather than a replacement created afterward. Accept enrols the invitee (or revives a membership they previously left) and applies the invite's systemRole; a provisional cookie is replaced with a full-access one. Decline closes the invite; a provisional cookie is cleared, leaving the account row in place. A full-access session keeps its cookies either way: accepting only adds a membership, which never shortens access. A caller authenticated with a bearer token rather than the cookie is answered in the body instead: an accept that upgrades a provisional session returns the new tokens in `session`, and no cookie is set or cleared. An invite that already carries an answer is a 409 — branch on error.code to decide where the caller goes next.
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
  "/v1/tracks/{id}": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post?: never;
    /**
     * Delete a track (admin only)
     * @description Removes a catalogue track no cohort runs. A track still attached to cohorts is refused with a 409.
     */
    delete: operations["TracksController_remove"];
    options?: never;
    head?: never;
    /**
     * Update a track (admin only)
     * @description A partial edit: only the fields present are written. code is trimmed and uppercased, and must be unique. An empty or null description clears it; name and code cannot be cleared.
     */
    patch: operations["TracksController_update"];
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
    /**
     * Delete a cohort (admin only)
     * @description Removes a cohort with nothing attached to it. A cohort that still has tracks, members or invites is refused with a 409.
     */
    delete: operations["CohortsController_remove"];
    options?: never;
    head?: never;
    /**
     * Update a cohort (admin only)
     * @description A partial edit: only the fields present are written. code is trimmed and uppercased, and must be unique. An endDate before the merged startDate is refused. null clears startDate or endDate; name, code and status cannot be cleared.
     */
    patch: operations["CohortsController_update"];
    trace?: never;
  };
  "/v1/cohorts/{id}/members": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /**
     * List a cohort’s members (admin only)
     * @description The roster: one row per membership, with the person who holds it, paginated. Staff first, then students, then guests, by name within each.
     *
     *     By default only the people in the cohort now — `state=live`, the rule sign-in uses. `state=ended` lists those who left, were dismissed, withdrew, deferred or graduated, and guests whose visit is over; `state=all` lists both. Each row says which it is.
     *
     *     Filter further with `role`, `trackId` and `status` (a student’s status); they combine with AND. A filter that matches nobody is an empty page; a cohort that does not exist is a 404.
     *
     *     A suspended account keeps its place on the roster. The row’s `user.status` says so.
     */
    get: operations["CohortsController_listMembers"];
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
  "/v1/cohorts/{id}/tracks/{trackId}": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post?: never;
    /**
     * Detach a track from a cohort (admin only)
     * @description Stops the cohort running a track: the reverse of POST /v1/cohorts/{id}/tracks, named by the same `trackId`. The track itself stays in the catalogue.
     *
     *     Refused with a 409 while anything in the cohort is still on the track — a student placed on it, or an invite that names it, whether pending or already settled. Nothing is moved or removed for you.
     *
     *     A cohort has to have its tracks detached before it can be deleted.
     */
    delete: operations["CohortsController_detachTrack"];
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/v1/cohorts/{cohortId}/members/{userId}": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    /**
     * Extend a guest's visit (admin only)
     * @description Moves when a guest membership ends. The new end must be in the future and later than the end it already has. The guest needs no sign-in: their next refresh reads the new end from the membership. A visit that has already ended is refused with a 409 — send a new invite instead.
     */
    patch: operations["CohortsController_extendVisit"];
    trace?: never;
  };
  "/v1/users": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /**
     * List users (admin only)
     * @description Every account, newest first, paginated, each with its live roster memberships.
     *
     *     Filters are all optional and combine with AND. `search` matches the address and the names; `systemRole` and `status` are about the account. `cohortId`, `trackId` and `cohortRole` are about a membership, and one membership has to satisfy all of those sent: `cohortId` + `trackId` is one cohort’s students on one track, and `cohortId` + `cohortRole=mentor` is that cohort’s mentors — not people in the cohort who mentor elsewhere.
     *
     *     Membership filters read live memberships only, the same rule sign-in uses: somebody who left, was dismissed, or whose guest visit ended is not in the cohort for this purpose. An id that names no cohort or track is an empty page, not a 404.
     *
     *     Memberships describe the roster, not access. A suspended account is listed with its memberships and matches the membership filters, but cannot sign in. `status=active` narrows a list to the people who can.
     */
    get: operations["UsersController_list"];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/v1/users/{id}/system-role": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    /**
     * Grant or revoke the admin role (admin only)
     * @description Send `admin` to make somebody an admin, `user` to make them an ordinary user again. Any admin may do either.
     *
     *     A grant takes effect on the person’s next request if they are signed in. Somebody signed out, or still answering an invitation, has it from their next sign-in. Revoking the role also signs the person out everywhere.
     *
     *     Two people are off limits, both answered with a 409:
     *
     *     - **A super admin.** Their role cannot be changed through the API in either direction. Super admins are the accounts in `DEFAULT_ADMIN_EMAIL`, set by the seed.
     *     - **Yourself.** Ask another admin, so nobody locks themselves out by a slip.
     *
     *     Setting the role somebody already has succeeds and changes nothing. `super_admin` is not an accepted value.
     */
    patch: operations["UsersController_setSystemRole"];
    trace?: never;
  };
  "/v1/users/me": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /**
     * Read your own profile
     * @description Everything on the signed-in account’s profile, including the phone number, which nobody else but an admin sees, and every cohort they hold a live place in.
     */
    get: operations["ProfileController_getOwn"];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    /**
     * Update your own profile
     * @description A partial update: names, display name, phone and bio. Leave a field out to keep it; send `null` or an empty string to clear it. Values are trimmed.
     *
     *     The address cannot be changed here: it is the Google account the person signs in with. Roles and memberships are not the person’s to edit, and neither, yet, is the photo.
     */
    patch: operations["ProfileController_updateOwn"];
    trace?: never;
  };
  "/v1/users/{id}/profile": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /**
     * View a member’s profile card
     * @description What one member sees of another: names, photo, bio, address and the cohorts the two share. The phone number is never on a card.
     *
     *     A member can open the card of anybody they share a live cohort with, and sees only the shared cohorts. An admin can open any card and sees every live cohort, as does a person opening their own.
     *
     *     Anything else answers 404 — no such account, a suspended one, or one the caller shares no cohort with — so a card cannot be used to find out who has an account.
     */
    get: operations["ProfileController_getCard"];
    put?: never;
    post?: never;
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
      | "INVITE_EXPIRED"
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
    GoogleTokenSignInDto: {
      /** @description The id_token Google's sign-in SDK gave the app, unmodified. It must be addressed to this deployment's web client or to one of its native app clients. */
      idToken: string;
    };
    /**
     * @description `full_access` belongs in the campus. `provisional` still has an invite to answer, and every route but onboarding refuses it.
     * @enum {string}
     */
    SessionScope: "provisional" | "full_access";
    TokenSignInResponseDto: {
      /** @description `full_access` belongs in the campus. `provisional` still has an invite to answer, and every route but onboarding refuses it. */
      scope: components["schemas"]["SessionScope"];
      /** @description Send as `Authorization: Bearer <accessToken>` on every call. */
      accessToken: string;
      /**
       * Format: date-time
       * @description When the access token lapses. Refresh a little before this.
       * @example 2026-09-30T12:15:00.000Z
       */
      expiresAt: string;
      /** @description Exchange at POST /v1/auth/refresh for a new pair. Works once: keep the one each refresh returns. Null for a provisional session, which cannot be refreshed. */
      refreshToken: string | null;
      /**
       * Format: date-time
       * @description When the refresh token lapses. Past this, the user signs in again. Null for a provisional session.
       * @example 2026-10-30T12:00:00.000Z
       */
      refreshExpiresAt: string | null;
      /**
       * @description The invite to answer, if any: for a provisional session, the one it was issued for; for a full-access session, a pending invite to another cohort. Load it with GET /v1/invites/validate-user-invite.
       * @example 66666666-6666-4666-8666-666666666666
       */
      inviteId: string | null;
    };
    /** @enum {string} */
    SystemRole: "user" | "admin" | "super_admin";
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
       * @description The invite to answer, if any: for a provisional session, the one it was issued for, or the live invite that replaced it if that one was revoked or lapsed; for a full-access session, a pending invite to another cohort. Load it with GET /v1/invites/validate-user-invite.
       * @example 66666666-6666-4666-8666-666666666666
       */
      inviteId?: string | null;
      user: components["schemas"]["SessionUserDto"];
      /** @description The first of `memberships` — only one, so it cannot describe somebody in several cohorts; read `memberships` instead. Null for a provisional session, and for an admin who holds no cohort place. */
      membership?: components["schemas"]["SessionMembershipDto"] | null;
      /** @description Every cohort this account may enter, most recently joined first — a person can belong to several, in any mix of roles. Empty for a provisional session and for an admin with no cohort place. `membership` is the first entry, kept while clients move to this. */
      memberships: components["schemas"]["SessionCohortPlaceDto"][];
    };
    RefreshTokenDto: {
      /** @description The refresh token, for a client that holds its tokens itself. Ignored when the refresh cookie is present. */
      refreshToken?: string;
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
      /** @description The new access token. Only when the refresh token came in the request body; a cookie refresh answers in cookies. */
      accessToken?: string;
      /** @description The new refresh token, replacing the one just spent. Only when the refresh token came in the request body. */
      refreshToken?: string;
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
       * @description Defaults to 'user'. Admin invites pass 'admin' with no cohort fields. An invite cannot make a super admin: only the seed does.
       * @example user
       * @enum {string}
       */
      systemRole?: "user" | "admin";
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
    /** @enum {string} */
    InviteImportOutcome: "invited" | "failed";
    InviteImportRowDto: {
      /**
       * @description The line in the file, counting the header as line 1, as a spreadsheet numbers it.
       * @example 2
       */
      line: number;
      /**
       * @description The address as the file gave it, lowercased.
       * @example ada@campus.local
       */
      email: string;
      outcome: components["schemas"]["InviteImportOutcome"];
      /**
       * @description Invited rows only.
       * @example 44444444-4444-4444-8444-444444444444
       */
      inviteId?: string;
      /**
       * @description Invited rows only. Shown once, as it is when one invite is created: share it by hand if `emailStatus` is not `sent`.
       * @example https://campus.example/invitation?token=…
       */
      inviteLink?: string;
      /** @description Invited rows only: whether the invite email went out. */
      emailStatus?: components["schemas"]["InviteEmailStatus"];
      /**
       * @description Failed rows only: why, in words for the admin.
       * @example A pending invite already exists for ada@campus.local
       */
      reason?: string;
    };
    InviteImportResponseDto: {
      /**
       * @description Rows in the file, header aside.
       * @example 3
       */
      total: number;
      /** @example 2 */
      invited: number;
      /** @example 1 */
      failed: number;
      /** @description One entry per row, in the order of the file. */
      rows: components["schemas"]["InviteImportRowDto"][];
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
    AdminInviteListItemDto: {
      /** @example 44444444-4444-4444-8444-444444444444 */
      id: string;
      /** @example new.student@campus.local */
      email: string;
      /** @description Read against expiresAt, not off the stored column: a lapsed invite is `expired` here even before anything has materialised the flip, so `pending` always means still redeemable. */
      status: components["schemas"]["InviteStatus"];
      /**
       * Format: uuid
       * @description Null for an invite that grants a system role only.
       * @example 11111111-1111-4111-8111-111111111111
       */
      cohortId: string | null;
      /** @description Null for an invite that grants a system role only. */
      cohortRole: components["schemas"]["CohortRole"] | null;
      systemRole: components["schemas"]["SystemRole"];
      /**
       * @description When the link stops being redeemable.
       * @example 2026-09-29T12:00:00.000Z
       */
      expiresAt: string;
      /**
       * Format: uuid
       * @description Who sent it. Never null — an invite always has an author.
       * @example 22222222-2222-4222-8222-222222222222
       */
      invitedBy: string;
      /**
       * Format: uuid
       * @description Who revoked it. Null unless status is `revoked`: accepted and declined invites have no actor to name. Also null on the few invites a data migration revoked, which nobody did by hand.
       * @example 33333333-3333-4333-8333-333333333333
       */
      revokedBy: string | null;
      /**
       * Format: date-time
       * @description When it was revoked. Null unless status is `revoked`.
       * @example 2026-09-25T09:30:00.000Z
       */
      revokedAt: string | null;
      /**
       * Format: date-time
       * @description When the invitee flagged a mistake on it. Null if they never did. A flag changes nothing else: the invite can still be accepted.
       * @example null
       */
      flaggedAt: string | null;
      /**
       * @description What the invitee said is wrong. Null unless flagged.
       * @example null
       */
      flagMessage: string | null;
      /** @example 2026-09-22T12:00:00.000Z */
      createdAt: string;
    };
    RevokeInviteResponseDto: {
      /** @example 44444444-4444-4444-8444-444444444444 */
      id: string;
      /** @example new.student@campus.local */
      email: string;
      /** @description Read against expiresAt, not off the stored column: a lapsed invite is `expired` here even before anything has materialised the flip, so `pending` always means still redeemable. */
      status: components["schemas"]["InviteStatus"];
      /**
       * Format: uuid
       * @description Null for an invite that grants a system role only.
       * @example 11111111-1111-4111-8111-111111111111
       */
      cohortId: string | null;
      /** @description Null for an invite that grants a system role only. */
      cohortRole: components["schemas"]["CohortRole"] | null;
      systemRole: components["schemas"]["SystemRole"];
      /**
       * @description When the link stops being redeemable.
       * @example 2026-09-29T12:00:00.000Z
       */
      expiresAt: string;
      /**
       * Format: uuid
       * @description Who sent it. Never null — an invite always has an author.
       * @example 22222222-2222-4222-8222-222222222222
       */
      invitedBy: string;
      /**
       * Format: uuid
       * @description Who revoked it. Null unless status is `revoked`: accepted and declined invites have no actor to name. Also null on the few invites a data migration revoked, which nobody did by hand.
       * @example 33333333-3333-4333-8333-333333333333
       */
      revokedBy: string | null;
      /**
       * Format: date-time
       * @description When it was revoked. Null unless status is `revoked`.
       * @example 2026-09-25T09:30:00.000Z
       */
      revokedAt: string | null;
      /**
       * Format: date-time
       * @description When the invitee flagged a mistake on it. Null if they never did. A flag changes nothing else: the invite can still be accepted.
       * @example null
       */
      flaggedAt: string | null;
      /**
       * @description What the invitee said is wrong. Null unless flagged.
       * @example null
       */
      flagMessage: string | null;
      /** @example 2026-09-22T12:00:00.000Z */
      createdAt: string;
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
      /**
       * Format: date-time
       * @description When the invitee flagged a mistake on this invite with POST /v1/invites/flag; null if they have not. An invite takes one flag, so once this is set the button has nothing left to do. Accepting works either way.
       * @example null
       */
      flaggedAt?: string | null;
      invitedBy: components["schemas"]["InvitedByDto"];
      /**
       * Format: date-time
       * @example 2026-09-22T12:00:00.000Z
       */
      createdAt: string;
      user: components["schemas"]["InviteInviteeDto"];
    };
    InviteFlagDto: {
      /**
       * @description What is wrong with the invite, in the invitee’s own words. Sent to the admin as written, so it has to say something: blank is refused.
       * @example I applied for the Product Design track, not Software Engineering.
       */
      message: string;
      /**
       * @description The invite being flagged — the id GET /v1/invites/validate-user-invite returned. Named under the same rule as POST /v1/invites/decision: required for a full-access session, optional for a provisional one, which otherwise flags the invite its session was issued for.
       * @example 66666666-6666-4666-8666-666666666666
       */
      inviteId?: string;
    };
    InviteFlagResponseDto: {
      /** @example 66666666-6666-4666-8666-666666666666 */
      inviteId: string;
      /**
       * Format: date-time
       * @example 2026-10-03T12:00:00.000Z
       */
      flaggedAt: string;
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
       * @description The invite being answered — the id GET /v1/invites/validate-user-invite returned. Required for a full-access session (a member invited to another cohort), so an invite replaced since the member read it is never accepted unseen. A provisional session may omit it to answer the invite its session was issued for. If that one was revoked and replaced, validate-user-invite shows the replacement, and answering it means naming it here; any other id is refused.
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
    SessionTokensDto: {
      /** @description `full_access` belongs in the campus. `provisional` still has an invite to answer, and every route but onboarding refuses it. */
      scope: components["schemas"]["SessionScope"];
      /** @description Send as `Authorization: Bearer <accessToken>` on every call. */
      accessToken: string;
      /**
       * Format: date-time
       * @description When the access token lapses. Refresh a little before this.
       * @example 2026-09-30T12:15:00.000Z
       */
      expiresAt: string;
      /** @description Exchange at POST /v1/auth/refresh for a new pair. Works once: keep the one each refresh returns. Null for a provisional session, which cannot be refreshed. */
      refreshToken: string | null;
      /**
       * Format: date-time
       * @description When the refresh token lapses. Past this, the user signs in again. Null for a provisional session.
       * @example 2026-10-30T12:00:00.000Z
       */
      refreshExpiresAt: string | null;
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
      /** @description The full-access session an accept upgraded a provisional one to. Present only when the request was authenticated with a bearer token rather than the cookie; replace the provisional token with it. Absent on a decline, and for a full-access caller, who keeps the session they came with. */
      session?: components["schemas"]["SessionTokensDto"];
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
    UpdateTrackDto: {
      /** @example Software Engineering */
      name?: string;
      /**
       * @description Unique across tracks. Stored uppercase.
       * @example SE
       */
      code?: string;
      /**
       * @description An empty string or null clears it.
       * @example Backend and infra
       */
      description?: string | null;
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
    RosterUserDto: {
      /** @example 22222222-2222-4222-8222-222222222222 */
      id: string;
      /** @example ada@campus.local */
      email: string;
      /** @example Ada */
      firstName: string | null;
      /** @example Lovelace */
      lastName: string | null;
      /** @example Ada L. */
      displayName: string | null;
      /** @example null */
      avatarUrl: string | null;
      /** @description The account’s own status. A suspended account keeps its place on the roster but cannot sign in. */
      status: components["schemas"]["UserStatus"];
    };
    RosterTrackDto: {
      /** @example 33333333-3333-4333-8333-333333333333 */
      id: string;
      /** @example Software Engineering */
      name: string;
      /** @example SE */
      code: string;
    };
    /**
     * @description Whether the membership counts now, read against the clock rather than off a column: a guest whose visit ended a minute ago is `ended` here.
     * @enum {string}
     */
    MembershipState: "live" | "ended";
    RosterMemberDto: {
      /**
       * @description The membership, not the person: one per person per cohort.
       * @example 77777777-7777-4777-8777-777777777777
       */
      id: string;
      user: components["schemas"]["RosterUserDto"];
      role: components["schemas"]["CohortRole"];
      /** @description Always set for a student. Staff and guests have one only when they were placed on a track; otherwise null. */
      track: components["schemas"]["RosterTrackDto"] | null;
      /** @description Students only; null for every other role. */
      status: components["schemas"]["StudentStatus"] | null;
      /** @description Whether the membership counts now, read against the clock rather than off a column: a guest whose visit ended a minute ago is `ended` here. */
      state: components["schemas"]["MembershipState"];
      /**
       * @description Why a dismissed student was dismissed. Null otherwise.
       * @example null
       */
      dismissalReason: string | null;
      /**
       * Format: date-time
       * @example 2026-09-22T12:00:00.000Z
       */
      joinedAt: string;
      /** Format: date-time */
      leftAt: string | null;
      /**
       * Format: date-time
       * @description Guests only: when the visit ends.
       */
      accessExpiresAt: string | null;
    };
    /** @enum {string} */
    RosterScope: "live" | "ended" | "all";
    AttachTrackDto: {
      /**
       * @description A track from GET /v1/tracks.
       * @example 33333333-3333-4333-8333-333333333333
       */
      trackId: string;
    };
    ExtendGuestVisitDto: {
      /**
       * Format: date-time
       * @description When the visit now ends: in the future, and later than the end it already has.
       * @example 2026-10-20T12:00:00.000Z
       */
      accessExpiresAt: string;
    };
    CohortMemberResponseDto: {
      /**
       * @description The membership's own id.
       * @example 55555555-5555-4555-8555-555555555555
       */
      id: string;
      /** @example 11111111-1111-4111-8111-111111111111 */
      cohortId: string;
      /** @example 44444444-4444-4444-8444-444444444444 */
      userId: string;
      role: components["schemas"]["CohortRole"];
      /**
       * Format: date-time
       * @description When the visit now ends.
       * @example 2026-10-20T12:00:00.000Z
       */
      accessExpiresAt: string;
    };
    UpdateCohortDto: {
      /** @example Cohort 1 */
      name?: string;
      /**
       * @description Unique across cohorts. Stored uppercase.
       * @example C1
       */
      code?: string;
      /**
       * Format: date
       * @description Null clears it.
       * @example 2026-09-01
       */
      startDate?: string | null;
      /**
       * Format: date
       * @description On or after startDate. Null clears it.
       * @example 2027-06-30
       */
      endDate?: string | null;
      status?: components["schemas"]["CohortStatus"];
    };
    UserMembershipCohortDto: {
      /** @example 11111111-1111-4111-8111-111111111111 */
      id: string;
      /** @example Product Design 2026 */
      name: string;
      /** @example PD26 */
      code: string;
    };
    UserMembershipTrackDto: {
      /** @example 55555555-5555-4555-8555-555555555555 */
      id: string;
      /** @example Product Design */
      name: string;
      /** @example PD */
      code: string;
    };
    UserMembershipDto: {
      cohort: components["schemas"]["UserMembershipCohortDto"];
      /** @description Set for students; null for every other role. */
      track: components["schemas"]["UserMembershipTrackDto"] | null;
      role: components["schemas"]["CohortRole"];
      /** @description Students only; null for every other role. */
      status: components["schemas"]["StudentStatus"] | null;
      /**
       * Format: date-time
       * @example 2026-09-22T12:00:00.000Z
       */
      joinedAt: string;
      /**
       * Format: date-time
       * @description Guests only: when the visit ends.
       * @example null
       */
      accessExpiresAt: string | null;
    };
    UserListItemDto: {
      /** @example 22222222-2222-4222-8222-222222222222 */
      id: string;
      /** @example ada@campus.local */
      email: string;
      /** @example Ada */
      firstName: string | null;
      /** @example Lovelace */
      lastName: string | null;
      /** @example Ada Lovelace */
      displayName: string | null;
      /** @example null */
      avatarUrl: string | null;
      systemRole: components["schemas"]["SystemRole"];
      status: components["schemas"]["UserStatus"];
      /**
       * Format: date-time
       * @description Null for an account that has never signed in.
       * @example 2026-10-01T08:15:00.000Z
       */
      lastLoginAt: string | null;
      /**
       * Format: date-time
       * @example 2026-09-22T12:00:00.000Z
       */
      createdAt: string;
      /**
       * @description Every live place this person holds on a roster, most recently joined first. All of them, whatever the filters: a filter chooses who is listed, not how much of them is shown. Empty for somebody with no live membership — an admin with no cohort, or a member who has left.
       *
       *     This is the roster, not access. A suspended account keeps its memberships and is listed with them, so an admin can see where the person belongs, but it cannot sign in: read `status` for that.
       */
      memberships: components["schemas"]["UserMembershipDto"][];
    };
    SetSystemRoleDto: {
      /**
       * @description `admin` to grant the admin role, `user` to revoke it. `super_admin` is not accepted: only the seed grants it.
       * @example admin
       * @enum {string}
       */
      systemRole: "user" | "admin";
    };
    UserSystemRoleDto: {
      /** @example 22222222-2222-4222-8222-222222222222 */
      id: string;
      /** @example ada@campus.local */
      email: string;
      systemRole: components["schemas"]["SystemRole"];
    };
    OwnProfileDto: {
      /** @example 22222222-2222-4222-8222-222222222222 */
      id: string;
      /**
       * @description The Google account they sign in with. Not editable.
       * @example ada@campus.local
       */
      email: string;
      /** @example Ada */
      firstName: string | null;
      /** @example Lovelace */
      lastName: string | null;
      /** @example Ada L. */
      displayName: string | null;
      /** @example null */
      phone: string | null;
      /** @example null */
      bio: string | null;
      /**
       * @description The picture Google gave at first sign-in. Null when it gave none.
       * @example https://lh3.googleusercontent.com/a/example
       */
      avatarUrl: string | null;
      /** @example null */
      spriteKey: string | null;
      systemRole: components["schemas"]["SystemRole"];
      /** @description Every cohort they hold a live place in. */
      memberships: components["schemas"]["UserMembershipDto"][];
      /**
       * Format: date-time
       * @example 2026-09-22T12:00:00.000Z
       */
      createdAt: string;
    };
    UpdateProfileDto: {
      /** @example Ada */
      firstName?: string | null;
      /** @example Lovelace */
      lastName?: string | null;
      /**
       * @description The name shown beside the avatar in the campus.
       * @example Ada L.
       */
      displayName?: string | null;
      /**
       * @description Digits, with an optional leading + and spaces, hyphens or brackets between them. Seen by the owner and admins only.
       * @example +234 801 234 5678
       */
      phone?: string | null;
      bio?: string | null;
    };
    ProfileCardMembershipDto: {
      cohort: components["schemas"]["UserMembershipCohortDto"];
      /** @description Set for students; null for every other role. */
      track: components["schemas"]["UserMembershipTrackDto"] | null;
      role: components["schemas"]["CohortRole"];
    };
    ProfileCardDto: {
      /** @example 22222222-2222-4222-8222-222222222222 */
      id: string;
      /** @example ada@campus.local */
      email: string;
      /** @example Ada */
      firstName: string | null;
      /** @example Lovelace */
      lastName: string | null;
      /** @example Ada L. */
      displayName: string | null;
      /** @example null */
      bio: string | null;
      /** @example null */
      avatarUrl: string | null;
      /** @example null */
      spriteKey: string | null;
      /** @description The cohorts the viewer shares with this person, most recently joined first. An admin, and the person themselves, see every live one. */
      memberships: components["schemas"]["ProfileCardMembershipDto"][];
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
  AuthController_tokenSignIn: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody: {
      content: {
        "application/json": components["schemas"]["GoogleTokenSignInDto"];
      };
    };
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["TokenSignInResponseDto"];
        };
      };
      /** @description UNAUTHORIZED: the id_token could not be verified, is addressed to a client this deployment does not name, or carries no verified email address. `details.reason` says which: exchange_failed, unverified_email or incomplete_profile. */
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorResponseDto"];
        };
      };
      /** @description INVITE_REQUIRED: nobody invited this address. ACCOUNT_SUSPENDED: the account exists but has been closed. */
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorResponseDto"];
        };
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
    requestBody: {
      content: {
        "application/json": components["schemas"]["RefreshTokenDto"];
      };
    };
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
    requestBody: {
      content: {
        "application/json": components["schemas"]["RefreshTokenDto"];
      };
    };
    responses: {
      204: {
        headers: {
          [name: string]: unknown;
        };
        content?: never;
      };
    };
  };
  InvitesController_list: {
    parameters: {
      query?: {
        /** @description Page to fetch, 1-based. */
        page?: number;
        /** @description Number of items per page. */
        perPage?: number;
        /** @description Restrict to one status. Omit for all of them. `pending` is what an admin wants most often — the open offers that are still redeemable — and `revoked` is the answer to "who killed this invite". */
        status?: components["schemas"]["InviteStatus"];
        /** @description `true` for the invites an invitee has flagged as wrong, `false` for the ones nobody has. Omit for both. Combine with `status=pending` for the flags still worth acting on. */
        flagged?: boolean;
        /** @description Invites to this cohort. An admin invite names no cohort, so it never matches. A cohort that does not exist matches nothing: an empty page, not a 404. */
        cohortId?: string;
        /** @description Invites placed on this track, in whichever cohort runs it: the catalogue track id, as the roster takes it. Add `cohortId` for one cohort’s intake on the track. */
        trackId?: string;
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
            items?: components["schemas"]["AdminInviteListItemDto"][];
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
  InvitesController_importCsv: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody: {
      content: {
        "multipart/form-data": {
          /**
           * Format: uuid
           * @description The cohort every row is invited to.
           */
          cohortId: string;
          /**
           * Format: binary
           * @description The CSV file.
           */
          file: string;
        };
      };
    };
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["InviteImportResponseDto"];
        };
      };
      /** @description No file, a cohortId that is not a UUID, or a file that cannot be read as a list of invites. */
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
      /** @description The file is larger than 256 KB. */
      413: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorResponseDto"];
        };
      };
    };
  };
  InvitesController_revoke: {
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
          "application/json": components["schemas"]["RevokeInviteResponseDto"];
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
      /**
       * @description Signed in, but not an admin.
       *
       *     FORBIDDEN: signed in, but not an admin. INVITE_EXPIRED: the invite has expired, so there is nothing to revoke.
       */
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorResponseDto"];
        };
      };
      /** @description No invite with this id. */
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorResponseDto"];
        };
      };
      /** @description INVITE_ALREADY_ACCEPTED, INVITE_ALREADY_DECLINED, or INVITE_REVOKED (this invite is already revoked). */
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
  InvitesController_resend: {
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
          "application/json": components["schemas"]["InviteResponseDto"];
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
      /** @description No invite with this id. */
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorResponseDto"];
        };
      };
      /** @description INVITE_ALREADY_ACCEPTED, INVITE_ALREADY_DECLINED or INVITE_REVOKED: the invite has been answered or cancelled. CONFLICT: an expired invite that can no longer be offered again — see the message. */
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
      /** @description INVITE_EXPIRED: the invite has expired. */
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
      /** @description The invite was still pending but its expiresAt has passed. The status is materialised to expired before this is thrown, and a replay answers the same INVITE_EXPIRED: lapsed and materialised are one outcome, so the code does not depend on what read the invite first. */
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
  InvitesController_flag: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody: {
      content: {
        "application/json": components["schemas"]["InviteFlagDto"];
      };
    };
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["InviteFlagResponseDto"];
        };
      };
      /** @description The message is missing, blank or too long, or a full-access session did not name the invite in `inviteId`. */
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorResponseDto"];
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
      /** @description INVITE_EXPIRED: the invite has expired. */
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorResponseDto"];
        };
      };
      /** @description No invite matches this session, or the one named. */
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorResponseDto"];
        };
      };
      /** @description CONFLICT: this invite is already flagged. INVITE_ALREADY_ACCEPTED, INVITE_ALREADY_DECLINED or INVITE_REVOKED: the invite is settled, with the same code every other route gives it. */
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
  TracksController_remove: {
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
      /** @description The track was deleted. */
      204: {
        headers: {
          [name: string]: unknown;
        };
        content?: never;
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
      /** @description No track has this id. */
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorResponseDto"];
        };
      };
      /** @description The track is still attached to cohorts. */
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
  TracksController_update: {
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
        "application/json": components["schemas"]["UpdateTrackDto"];
      };
    };
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["TrackResponseDto"];
        };
      };
      /** @description A malformed or null name or code, or id is not a UUID. */
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
      /** @description No track has this id. */
      404: {
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
  CohortsController_remove: {
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
      /** @description The cohort was deleted. */
      204: {
        headers: {
          [name: string]: unknown;
        };
        content?: never;
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
      /** @description The cohort still has tracks, members or invites. */
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
  CohortsController_update: {
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
        "application/json": components["schemas"]["UpdateCohortDto"];
      };
    };
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["CohortResponseDto"];
        };
      };
      /** @description A malformed field, a null name, code or status, or an endDate before startDate. id is not a UUID. */
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
  CohortsController_listMembers: {
    parameters: {
      query?: {
        /** @description Page to fetch, 1-based. */
        page?: number;
        /** @description Number of items per page. */
        perPage?: number;
        /** @description `live` (the default) for the people in the cohort now; `ended` for those who left, were dismissed, withdrew, deferred, graduated, or whose guest visit is over; `all` for both. */
        state?: components["schemas"]["RosterScope"];
        role?: components["schemas"]["CohortRole"];
        /** @description Members on this track: its students, and any staff or guest who was placed on it. Add `role=student` for the students alone. */
        trackId?: string;
        /** @description Students with this status. Anything but `active` is an ended membership, so combine it with `state=ended` or `state=all`. */
        status?: components["schemas"]["StudentStatus"];
      };
      header?: never;
      path: {
        id: string;
      };
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
            items?: components["schemas"]["RosterMemberDto"][];
          };
        };
      };
      /** @description The id or a filter is malformed. */
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
  CohortsController_detachTrack: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        id: string;
        /** @description The track, as attached: the same id POST took as trackId. */
        trackId: string;
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description The track was detached. */
      204: {
        headers: {
          [name: string]: unknown;
        };
        content?: never;
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
      /** @description No cohort has this id, or the cohort does not run this track. */
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorResponseDto"];
        };
      };
      /** @description Students or invites in the cohort are still on the track. */
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
  CohortsController_extendVisit: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        cohortId: string;
        userId: string;
      };
      cookie?: never;
    };
    requestBody: {
      content: {
        "application/json": components["schemas"]["ExtendGuestVisitDto"];
      };
    };
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["CohortMemberResponseDto"];
        };
      };
      /** @description cohortId or userId is not a UUID, accessExpiresAt is not a date, is not in the future, or is not later than the current end. */
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
      /** @description Nobody in that cohort has this membership. */
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorResponseDto"];
        };
      };
      /** @description The membership has left, is not a guest, or the visit has ended. */
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
  UsersController_list: {
    parameters: {
      query?: {
        /** @description Page to fetch, 1-based. */
        page?: number;
        /** @description Number of items per page. */
        perPage?: number;
        /** @description Matches any part of the email address, first name, last name, full name or display name, ignoring case. */
        search?: string;
        systemRole?: components["schemas"]["SystemRole"];
        /** @description The account’s own status, not a membership’s. */
        status?: components["schemas"]["UserStatus"];
        /** @description People with a live membership in this cohort. */
        cohortId?: string;
        /** @description People with a live membership on this track, in any cohort that runs it. Send `cohortId` as well for one cohort’s intake of the track. Only students are placed on a track, so this finds students. */
        trackId?: string;
        /** @description People holding this role in a live membership. */
        cohortRole?: components["schemas"]["CohortRole"];
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
            items?: components["schemas"]["UserListItemDto"][];
          };
        };
      };
      /** @description A filter is malformed: not a UUID, or not one of the enum. */
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
    };
  };
  UsersController_setSystemRole: {
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
        "application/json": components["schemas"]["SetSystemRoleDto"];
      };
    };
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["UserSystemRoleDto"];
        };
      };
      /** @description The id is not a UUID, or systemRole is not `user` or `admin`. */
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
      /** @description No user has this id. */
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorResponseDto"];
        };
      };
      /** @description The target is a super admin, or is the caller. */
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
  ProfileController_getOwn: {
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
          "application/json": components["schemas"]["OwnProfileDto"];
        };
      };
      /** @description No usable full-access session. */
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
  ProfileController_updateOwn: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody: {
      content: {
        "application/json": components["schemas"]["UpdateProfileDto"];
      };
    };
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["OwnProfileDto"];
        };
      };
      /** @description A field is too long, or the phone is not a phone number. */
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorResponseDto"];
        };
      };
      /** @description No usable full-access session. */
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
  ProfileController_getCard: {
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
          "application/json": components["schemas"]["ProfileCardDto"];
        };
      };
      /** @description The id is not a UUID. */
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorResponseDto"];
        };
      };
      /** @description No usable full-access session. */
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorResponseDto"];
        };
      };
      /** @description No profile the caller may see under this id. */
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
}
