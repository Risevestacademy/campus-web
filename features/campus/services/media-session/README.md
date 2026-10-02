# Campus media session

This service owns browser camera, microphone, and speaker state for one campus
route. It is intentionally separate from signaling and media transport.

The route-scoped provider owns capture resources. UI components consume Zustand
selectors, while a `MeetingMediaTransport` receives local publication changes
and supplies remote publications. The production transport is a no-op until the
backend signaling/SFU integration is implemented.

Camera and microphone intent is remembered in browser local storage and
defaults to off when no valid preference exists. Startup acquires only enabled
sources. Camera off stops and removes the camera track so the browser can
release the physical device; microphone off remains a soft mute after capture
has started. These preferences stay client-owned when a backend transport is
added.

Media is modeled as source-aware publications rather than one stream per
participant. Remote publications are indexed by participant and source so a
publication update only invalidates the matching tile selector. Camera and
microphone are supported now; a later screen-sharing session can add a `screen`
publication without replacing the transport or registry.
