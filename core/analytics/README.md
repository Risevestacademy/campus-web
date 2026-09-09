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
captureBrowserAnalyticsEvent(ANALYTICS_EVENTS.AUTH_LOGIN_SUBMITTED, {
  auth_method: "rise_sso",
  platform: "web",
});
```

## Server example

```ts
await captureServerAnalyticsEvent(
  ANALYTICS_EVENTS.AUTH_LOGIN_SUCCEEDED,
  user.id,
  {
    auth_method: "rise_sso",
    role: user.role,
    user_id: user.id,
  },
);
```

When called from a Next.js Route Handler or Server Action, schedule the
capture with Next.js `after()` when the event should not add latency to the
response.

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
