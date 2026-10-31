# Analytics

Typed PostHog product analytics for Campus by Rise.

## Boundaries

- Browser code imports from `core/analytics/client`.
- The consent banner, its Privacy choices control and `useAnalyticsConsent`
  come from `core/analytics/consent`.
- Server-only code imports from `core/analytics/server`.
- Feature code uses `ANALYTICS_EVENTS`; it does not import PostHog.
- Trusted outcomes are emitted by the server with the authenticated
  Campus/Rise user ID.
- Browser identification uses the same stable ID. It runs on cohort pages,
  through auth's `CohortSession`, with only `system_role` as a person
  property. `enterAnalyticsCohort` keeps `cohort_id` and `cohort_role` in
  memory, a `before_send` step adds them to the tab's events with
  `$groups: { cohort }` (the group campus-api and world use; never
  `posthog.group()`, which persists it), and the returned cleanup drops them. Memory ends with the page, so a full load never inherits
  a cohort and a PostHog session rotation never drops one. Browser capture and
  identify wait for consent (see Consent).
- `identifyAnalyticsUser` forgets a different member still identified on the
  device first; auth's sign-in and invitation pages call
  `resetIdentifiedAnalyticsUser()` for a signed-out visitor. Every reset passes
  `resetDeviceID: true`, so a later member is never joined to an earlier one
  through `$device_id`. The cost: a member signing back in counts as a new
  device. People are counted by distinct ID, so person metrics are unaffected.
- `BrowserPageview`, the last child of the root layout, captures `$pageview`
  once per pathname in a row (`capture_pageview: false`), so Strict Mode's
  second mount in development sends nothing. React runs mount effects in tree
  order and every call queues on one SDK promise, so a page's reset, identify
  or cohort entry always reaches PostHog before its pageview. A `loading.tsx`
  or Suspense boundary that streams a page in after the root mounts would
  break that order.
- Logout captures its event before calling `resetAnalyticsUser()`.

## Successful business operations

The owning feature application service chooses each trusted event after its DAL
or repository confirms that the business operation succeeded. The `distinctId`
must come from the verified authentication context, never from request input.

`captureServerAnalyticsEvent` is best-effort and already prevents PostHog
delivery failures from reversing a successful business operation.

For request-driven operations, inject a feature-specific analytics port whose
Next.js adapter schedules `captureServerAnalyticsEvent` with `after()`. The
feature calls that port only after persistence succeeds. This keeps the event
decision in the owning domain without placing PostHog latency on the response
path.

Never place the business operation itself inside `after()`. Do not schedule a
success event before persistence succeeds because `after()` also runs for
failed responses.

Events that become audit-, billing-, or compliance-critical require a
transactional outbox instead of best-effort PostHog delivery.

## Collection policy

The configuration captures pageviews (through `BrowserPageview`) and explicitly
declared events.
Autocapture, page-leave capture, session replay, heatmaps, dead-click and
exception capture are disabled. Person profiles are created only for
identified users.

Every event passes three privacy layers:

1. `analyticsEventSchemas` in `events.ts` is the allow-list. Each event is a
   `z.object` of enums, numbers, opaque IDs and short labels; capture strips
   any undeclared key and drops an event that fails, logging only issue codes
   and paths, never values. The distinct ID and identity are checked the same
   way, so an email can never become a distinct ID.
2. `before_send` adds the active cohort, then runs `scrubAnalyticsEvent`
   (`scrub.ts`), which removes the
   query string and hash from every URL-shaped property, keeping only `page`
   and `view`.
3. `mask_personal_data_properties` with `token`, `returnTo`, `code` and
   `state` covers the first URL PostHog stores at init, before `before_send`
   runs.

Adding an event or property means adding it to `analyticsEventSchemas` and to
the allow-list in `tests/evals/data-privacy.eval.test.ts`.

An absent `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN` disables browser and server
analytics during local development. CI and Vercel builds require both
analytics variables. The project token must begin with `phc_`, and the host
must be a valid HTTPS URL.

Use the development PostHog project for local, preview, and staging
environments. Use the production PostHog project only for production
deployments. Configure these as environment-scoped variables in the
deployment provider.

The project token begins with `phc_` and is public by design. Personal API
keys and other secrets must never use a `NEXT_PUBLIC_` variable.

Analytics consumes normalized browser-safe values from
`config/environment/public.ts`; it does not access `process.env` directly.

## Consent

PostHog starts opted out (`opt_out_capturing_by_default`) with persistence
off (`opt_out_persistence_by_default`) and flags off
(`advanced_disable_flags`; Campus uses none, and they would call `/flags/`
with a visitor ID before any choice). Before a choice and after Reject it
sends no request at all and writes no `ph_*` cookie or storage.

`core/analytics/consent` owns the choice:

- `AnalyticsConsentBanner`, mounted once in the root layout, asks while the
  choice is `pending`. Reject and Accept carry equal weight; Escape and outside
  clicks decide nothing. The copy says the choice applies to everyone using
  this browser. It sits bottom-left, raised above the Presence Dock, so call
  controls stay reachable before a choice.
- Accept calls `grantAnalyticsConsent`: `opt_in_capturing()` sends one
  `$opt_in`, then it identifies a member who was waiting on a cohort page and
  captures the page's `$pageview`. `BrowserPageview` already ran while opted
  out, and `opt_in_capturing()` sends no pageview with `capture_pageview` off.
- Reject calls `denyAnalyticsConsent`: when consent had been granted it
  resets with a new device ID, so the device is unlinked from the member, then
  `opt_out_capturing()`, then removes the tab's `ph_<token>_window_id` and
  `ph_<token>_primary_window_exists`, which opting out leaves behind. Events
  captured before Reject may still be sent.
- `PrivacyChoicesButton`, mounted in the root layout above the theme toggle,
  and a "Privacy choices" item in the campus rail are a switch
  (`toggleAnalyticsConsentChoices`): one press shows the banner, the next hides
  it. Both appear once the choice is known and stay after a choice, so it can
  still be changed. Hiding a choice not yet made leaves it pending (nothing is
  granted) and the next press brings it back. A reopened banner takes focus; a
  choice or Escape closes it and returns focus to the opener. Escape keeps the
  earlier choice.

The choice lives in PostHog's consent key, renamed to `campus_analytics_consent`
(`consent_persistence_name`, `ANALYTICS_CONSENT_KEY`; `1` or `0`) in
localStorage; there is no second copy. `reset()` clears that key, so every
reset (logout, session expiry, sign-in, identify as another member) reads the
choice first and re-applies it, without a new `$opt_in`. A logout or sign-in
also drops a member still waiting for Accept.

Other tabs follow through `storage` events on that key (`watchAnalyticsConsent`)
as if the choice were made there: their banner closes, and a Reject opts out
and clears that tab's keys too. On an Accept, the tab first loads the IDs the
accepting tab stored, so one browser stays one device, then opts in without
another `$opt_in` and identifies its waiting member.

The `$opt_in` count in PostHog is the consent-uptake trace. A rejection sends
nothing, by design.

Campus members are adults (18+), so no age-specific consent applies.

### Known gaps

- The choice is per browser, not per account: campus-api has no consent
  field. The next member on a shared browser inherits it; the banner says so.
- Where localStorage cannot be written, PostHog keeps the choice in memory
  and the banner asks again on the next load. Nothing is captured meanwhile.
- The banner links no privacy policy yet.
- Server events from `captureServerAnalyticsEvent` (login and signup
  outcomes) are not consent-gated. They set no browser storage, but they are
  PostHog data about the member.

## Browser example

```ts
import { ANALYTICS_EVENTS } from "@/core/analytics";
import { captureBrowserAnalyticsEvent } from "@/core/analytics/client";

captureBrowserAnalyticsEvent(ANALYTICS_EVENTS.AUTH_LOGIN_SUBMITTED, {
  auth_method: "rise_sso",
  platform: "web",
});
```

`instrumentation-client.ts` starts loading PostHog as its own chunk, so the
SDK stays off the hydration path. Calls made before it loads are delivered
once it does, in call order. Feature code calls the typed capture function; it
does not initialize PostHog itself.

## Server example

```ts
interface ProfileAnalytics {
  profileSetupCompleted(distinctId: string, profile: CompletedProfile): void;
}

interface ProfileCommandContext {
  authenticatedUserId: string;
}

export async function completeProfileSetup(
  input: CompleteProfileSetupInput,
  context: ProfileCommandContext,
  analytics: ProfileAnalytics,
) {
  const profile = await profileRepository.complete(
    input,
    context.authenticatedUserId,
  );

  analytics.profileSetupCompleted(context.authenticatedUserId, profile);

  return profile;
}
```

The repository operation completes before the event is scheduled. The
composition root constructs the command context from the verified Campus
session; request input never supplies the authenticated user ID. Event
properties come from trusted service results. The feature-specific adapter maps
`CompletedProfile` to the canonical typed event properties.

`captureServerAnalyticsEvent` is disabled when the PostHog project token is
absent and catches delivery errors when PostHog is unavailable. It must not be
used for audit-, billing-, or compliance-critical delivery.

The Next.js adapter implements `profileSetupCompleted` by calling
`after(() => captureServerAnalyticsEvent(...))`. The feature owns when and why
the event is emitted; the adapter owns deferred PostHog delivery.

No analytics endpoint is needed. A normal API endpoint reaches PostHog only
when its successful feature service explicitly emits an event.

## Development verification

Configure `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN` and
`NEXT_PUBLIC_POSTHOG_HOST` for the development PostHog project, restart the
development server, and perform the real product operation.

Verify that:

1. The expected canonical event appears once in the development project.
2. Its distinct ID matches the authenticated user.
3. Its properties contain only the declared typed fields.
4. A rejected or failed business operation emits no success event.
5. Removing the token disables capture without breaking the operation.

## Verification

Run the unit tests, `pnpm eval:analytics` (contract, identity and consent; the
consent eval drives the real SDK) and `pnpm eval:privacy`, then use a normal browser with
the non-production project token configured. Confirm:

1. In a fresh profile, no PostHog request at all (`/flags/`, `/e/`,
   `config.js`) and no `ph_*` cookie or storage key appear before a choice;
   after Accept, one `$opt_in` and then a `$pageview` appear.
2. One additional `$pageview` appears after client navigation.
3. No autocapture or session replay events appear.
4. No PostHog request occurs when the token is empty.
5. Identifying and resetting a test account does not leak identity to the
   next anonymous session.
6. A protected build fails when either analytics variable is missing.
7. Opening an invite link produces a `$pageview` whose `$current_url` holds no
   `token`.

Playwright runs against a build that carries the token. Fixture tests block
`*.posthog.com` and store a Reject before every page loads
(`tests/e2e/support/analytics.ts`), so the banner never mounts over a click.
A `NEXT_PUBLIC_POSTHOG_HOST` outside `posthog.com` would not be blocked.
