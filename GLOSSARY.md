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
The required media-setup step before a user enters an active campus experience.
Code and tests call it pre-join (`/campus/{id}/join`).
_Avoid_: Join page, onboarding redirect

**Route Access Decision**:
The answer to whether a session may render a route: allow, redirect, forbidden,
or unavailable. Unavailable means the session could not be read, never that the
user is signed out.
_Avoid_: Auth check, permission result

**Return Destination**:
The sanitized same-origin Campus or invitation path a visitor goes back to
after refresh, sign-in, or the Join Gate. Unsafe values fall back to `/campus`.
_Avoid_: Redirect URL, next URL

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

**Route-scoped media session**:
Media state owned by the dynamic campus route so it survives navigation
between Join and active-campus screens but ends when leaving that route.
_Avoid_: Global media state, page-local media state

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
by a signaling or SFU adapter.
_Avoid_: Browser capture ownership, server media state
