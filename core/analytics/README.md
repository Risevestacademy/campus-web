# Analytics

Typed PostHog product analytics for Campus by Rise.

## Boundaries

- Browser code imports from `core/analytics/client`.
- Server-only code imports from `core/analytics/server`.
- Feature code uses `ANALYTICS_EVENTS`; it does not import PostHog.
- Trusted outcomes are emitted by the server with the authenticated
  Campus/Rise user ID.
- Browser identification uses the same stable ID.
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

The initial configuration captures pageviews and explicitly declared events.
Autocapture, page-leave capture, and session replay are disabled. Person
profiles are created only for identified users.

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

## Browser example

```ts
import { ANALYTICS_EVENTS } from "@/core/analytics";
import { captureBrowserAnalyticsEvent } from "@/core/analytics/client";

captureBrowserAnalyticsEvent(ANALYTICS_EVENTS.AUTH_LOGIN_SUBMITTED, {
  auth_method: "rise_sso",
  platform: "web",
});
```

`instrumentation-client.ts` initializes browser analytics. Feature code calls
the typed capture function; it does not initialize PostHog itself.

## Server example

```ts
import type { AuthenticatedActor, RouteExecutionContext } from "@/core/api";

interface ProfileAnalytics {
  profileSetupCompleted(distinctId: string, profile: CompletedProfile): void;
}

export async function completeProfileSetup(
  input: CompleteProfileSetupInput,
  context: RouteExecutionContext<AuthenticatedActor>,
  analytics: ProfileAnalytics,
) {
  const profile = await profileRepository.complete(input, context.actor.id);

  analytics.profileSetupCompleted(context.actor.id, profile);

  return profile;
}
```

The repository operation completes before the event is scheduled. The distinct
ID comes from the verified actor, while event properties come from trusted
service results. The feature-specific adapter maps `CompletedProfile` to the
canonical typed event properties.

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

Run the unit tests and contract evaluation, then use a normal browser with
the non-production project token configured. Confirm:

1. One initial `$pageview` appears.
2. One additional `$pageview` appears after client navigation.
3. No autocapture or session replay events appear.
4. No PostHog request occurs when the token is empty.
5. Identifying and resetting a test account does not leak identity to the
   next anonymous session.
6. A protected build fails when either analytics variable is missing.
