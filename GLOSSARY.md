# Campus Access

This context describes how a verified identity gains and retains access to
Campus, including the required transition through media setup.

## Language

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
