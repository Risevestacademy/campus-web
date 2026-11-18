import { ANALYTICS_EVENTS, type AnalyticsEventMap } from "./events";

const validLoginSubmission: AnalyticsEventMap[typeof ANALYTICS_EVENTS.AUTH_LOGIN_SUBMITTED] =
  {
    auth_method: "email",
    platform: "web",
  };

const forbiddenLoginSubmission: AnalyticsEventMap[typeof ANALYTICS_EVENTS.AUTH_LOGIN_SUBMITTED] =
  {
    auth_method: "email",
    platform: "web",
    // @ts-expect-error Passwords are not part of the analytics contract.
    password: "must-not-be-captured",
  };

void validLoginSubmission;
void forbiddenLoginSubmission;
