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

**OAuth Attempt**:
One expiring Google sign-in journey whose start and callback must be correlated.
_Avoid_: Login request, OAuth session

**Join Return Destination**:
The exact campus join page to visit after a successful OAuth Attempt.
_Avoid_: Redirect URL, callback URL

**Join Gate**:
The required media-setup step before a user enters an active campus experience.
_Avoid_: Join page, onboarding redirect

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

**Media control preference**:
The locally remembered user intent for whether a camera or microphone should
begin enabled in a campus session.
_Avoid_: Track state, server mute state

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

**Soft mute**:
Disabling a `MediaStreamTrack` while retaining ownership of the live track.
_Avoid_: Track release, publication removal

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
