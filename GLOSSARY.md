# Campus Glossary

Domain language is grouped by bounded context.

## Campus Access

This context describes how a verified identity gains and retains access to
Campus, including the required transition through media setup.

### Language

**Campus Access Session**:
A verified user's authorization context for Campus. It is either provisional
or full-access.
_Avoid_: Auth session, campus session

**Full-Access Session**:
A renewable Campus Access Session held by an administrator, an active member,
or a user who accepted an invitation.
_Avoid_: Normal session, complete session

**Provisional Session**:
A limited Campus Access Session for a verified user who has not yet gained
membership through an invitation.
_Avoid_: Partial session, temporary login

**Session Renewal**:
Renewing a Full-Access Session's access before it lapses while a Cohort page
stays open, so no navigation or Presence Session is interrupted. A cold load
with lapsed access still goes through the refresh page.
_Avoid_: Silent refresh, token refresh, keep-alive

**Invite Link**:
The emailed `/invitation?token=…` URL. Its token lets anyone holding it read
the invitation, never act on it.
_Avoid_: Invite code, magic link

**Invite Preview**:
The public read of an invitation by its token, before sign-in.
_Avoid_: Invite validation (that is the signed-in read of the session's invite)

**OAuth Attempt**:
One expiring Google sign-in journey whose start and callback must be correlated.
_Avoid_: Login request, OAuth session

**Join Return Destination**:
The exact campus join page to visit after a successful OAuth Attempt.
_Avoid_: Redirect URL, callback URL

**Join Gate**:
The required media-setup step before a user enters the Active Campus.
Code and tests call it pre-join (`/campus/{id}/join`).
_Avoid_: Join page, onboarding redirect

**Active Campus**:
A cohort's live campus that a member enters after the Join Gate: the map or
meeting view, the sidebar panels, and the campus controls.
_Avoid_: Campus room, main campus

**Presence Session**:
One browser document's joined, real-time presence in one Cohort. It starts at
Join, continues across every page of that Cohort, and ends on Leave, on
leaving the Cohort, on reload, or when another tab takes it over.
_Avoid_: Campus session, call, Campus Access Session

**Presence Tab**:
The one browser tab holding a member's Presence Session for a Cohort. Another
tab on that Cohort may move the session to itself, but a browser never holds
two for the same Cohort; each Cohort may have its own.
_Avoid_: Joined tab, active tab, primary tab

**Admission**:
The Presence Session's record that Join completed. Join grants one exact
destination; arriving there admits the session. It is workflow state, never
an authorization credential.
_Avoid_: Entry cookie, join token

**Presence Dock**:
The compact corner controls shown on every joined Cohort page that is not the
map or meeting view, so the member stays visibly connected.
_Avoid_: Mini player, floating toolbar

**Campus Shell**:
The rail and sidebar frame around every page of one Cohort. Active Campus and
Cohort Administration both render inside it.
_Avoid_: Layout, chrome

**Route Access Decision**:
The answer to whether a session may render a route: allow, redirect, forbidden,
or unavailable. Unavailable means the session could not be read, never that the
user is signed out.
_Avoid_: Auth check, permission result

**Return Destination**:
The sanitized same-origin Campus or invitation path a visitor goes back to
after refresh, sign-in, or the Join Gate. Unsafe values fall back to `/campus`.
_Avoid_: Redirect URL, next URL

## Campus Administration

This context describes system-administrator operations for scheduled learning
intakes, reusable learning paths, and invitations.

### Language

**System Administrator**:
A full-access user whose system role permits administration across Cohorts.
Backend authorization remains authoritative for every operation.
_Avoid_: Cohort administrator, programme administrator

**Cohort**:
A scheduled learning intake with its own dates, status, members, and attached
Programme Tracks.
_Avoid_: Campus, Programme Track, batch

**Programme Track**:
A reusable catalogue entry describing a learning path that may be attached to
multiple Cohorts.
_Avoid_: Cohort Track, media track

**Cohort Track**:
The association between one Cohort and one Programme Track. Detaching it
removes only the association; it never deletes the Programme Track.
_Avoid_: Programme Track, cohort course

**Cohort Administration**:
The System Administrator pages for one Cohort. They sit outside Active Campus
but inside the Presence Session, so entering them keeps the member connected.
_Avoid_: Admin panel, admin dashboard

**Invitation**:
A lifecycle record inviting a person to a Cohort. It may be pending, accepted,
declined, expired, or revoked. Resending or revoking changes the lifecycle; it
is not generic CRUD.
_Avoid_: Invite Link, invitation token

## Campus Media

The language used for browser-owned media in a campus session.

### Language

**Capture source**:
A browser-owned camera or microphone input. Screen capture remains a separate
future module.
_Avoid_: Participant stream, media publication

**Device catalog**:
The cameras, microphones, and speakers currently known to a campus media
session, together with whether that knowledge is current or stale.
_Avoid_: Device list, device inventory

**Media device preference**:
The locally remembered camera, microphone, or speaker device ID. It never
implies permission to begin capture in a new route session.
_Avoid_: Persisted media intent, server media state

**Publication**:
A track with a stable ID, source role, enabled state, and stream used by
rendering and transport adapters.
_Avoid_: Raw track, participant stream

**Local publication**:
A publication captured by the current browser session.
_Avoid_: Local stream

**Remote publication**:
A publication received for another participant through a transport adapter.
_Avoid_: Remote stream

**Hard release**:
Invalidating pending acquisition and stopping and removing an owned track and
its local publication when the user turns a capture source off.
_Avoid_: Soft mute, retained disabled track

**Transactional input switch**:
Acquiring and publishing a replacement input before stopping the current
track.
_Avoid_: Immediate device replacement

**Cohort media session**:
Media state owned by the Presence Session, so it survives navigation between
the Join Gate and every Cohort page but ends when the Presence Session ends.
_Avoid_: Global media state, page-local media state, route-scoped media
session

**Output routing**:
Applying a selected speaker to remote media output where the browser supports
explicit sink selection.
_Avoid_: Audio capture, microphone selection

**Screen publication**:
A publication whose source is `screen` and which can coexist with a camera
publication.
_Avoid_: Camera replacement

**Transport seam**:
The `MeetingMediaTransport` interface where publication events are translated
by a signaling or SFU adapter. The adapter picks its own rooms and reports
remote publications, per-participant audio gains and a Call status; no room
grant crosses it. It connects only after Admission and disconnects when the
Presence Session ends.
_Avoid_: Browser capture ownership, server media state

**Call**:
The audio room World grants for the space a member is in, or none. Each new
space brings a new Call while the Presence Session carries on.
_Avoid_: Meeting, room grant, Presence Session

**Hearing**:
How a Call decides who hears whom: `proximity` (only nearby members, louder
when closer) or `room` (everyone in the space).
_Avoid_: Audio mode

**Audible radius**:
The distance in tiles at which a nearby member fades to silence under
proximity Hearing.
_Avoid_: Hearing range
