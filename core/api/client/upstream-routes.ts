import type { paths } from "./generated/schema";

const PUBLISHED_ROUTES = {
  "/v1": true,
  "/v1/health": true,
  "/v1/auth/google": true,
  "/v1/auth/google/callback": true,
  "/v1/auth/google/token": true,
  "/v1/auth/me": true,
  "/v1/auth/refresh": true,
  "/v1/auth/logout": true,
  "/v1/invites": true,
  "/v1/invites/import": true,
  "/v1/invites/{id}/revoke": true,
  "/v1/invites/{id}/resend": true,
  "/v1/invites/preview": true,
  "/v1/invites/validate-user-invite": true,
  "/v1/invites/flag": true,
  "/v1/invites/decision": true,
  "/v1/tracks": true,
  "/v1/tracks/{id}": true,
  "/v1/cohorts": true,
  "/v1/cohorts/{id}": true,
  "/v1/cohorts/{id}/members": true,
  "/v1/cohorts/{id}/tracks": true,
  "/v1/cohorts/{id}/tracks/{trackId}": true,
  "/v1/cohorts/{cohortId}/members/{userId}": true,
  "/v1/cohorts/{cohortId}/members/{userId}/dismiss": true,
  "/v1/cohorts/{cohortId}/members/{userId}/withdraw": true,
  "/v1/cohorts/{cohortId}/members/{userId}/defer": true,
  "/v1/cohorts/{cohortId}/members/{userId}/graduate": true,
  "/v1/cohorts/{cohortId}/members/{userId}/remove": true,
  "/v1/users": true,
  "/v1/users/{id}/system-role": true,
  "/v1/users/{id}/suspend": true,
  "/v1/users/{id}/reinstate": true,
  "/v1/users/me": true,
  "/v1/users/{id}/profile": true,
  "/v1/audit-log": true,
  "/v1/maps/sync": true,
  "/v1/feedback": true,
  "/v1/feedback/{id}": true,
} as const satisfies Record<keyof paths, true>;

const PARAMETER_SEGMENT = /^\{[A-Za-z]+\}$/;
const DOT_SEGMENTS = new Set([".", ".."]);
const PARAMETER = Symbol("parameter");

type TemplateSegment = string | typeof PARAMETER;

interface CompiledTemplate<Template extends string> {
  segments: readonly TemplateSegment[];
  template: Template;
}

export const PUBLISHED_ROUTE_TEMPLATES = Object.keys(
  PUBLISHED_ROUTES,
) as readonly (keyof paths)[];

function compileTemplate<Template extends string>(
  template: Template,
): CompiledTemplate<Template> {
  const segments = template
    .split("/")
    .slice(1)
    .map((segment) => (PARAMETER_SEGMENT.test(segment) ? PARAMETER : segment));
  return { segments, template };
}

function isParameterValue(segment: string): boolean {
  return segment !== "" && !DOT_SEGMENTS.has(segment);
}

function matchesSegment(
  templateSegment: TemplateSegment,
  segment: string,
): boolean {
  return templateSegment === PARAMETER
    ? isParameterValue(segment)
    : templateSegment === segment;
}

function matchesSegments(
  templateSegments: readonly TemplateSegment[],
  path: readonly string[],
): boolean {
  return (
    templateSegments.length === path.length &&
    templateSegments.every((templateSegment, index) => {
      const segment = path[index];
      return segment !== undefined && matchesSegment(templateSegment, segment);
    })
  );
}

export function createRouteMatcher<Template extends string>(
  templates: readonly Template[],
): (path: readonly string[]) => Template | undefined {
  const compiledTemplates = templates.map(compileTemplate);

  return (path) =>
    compiledTemplates.find(({ segments }) => matchesSegments(segments, path))
      ?.template;
}

export const findPublishedRoute = createRouteMatcher(PUBLISHED_ROUTE_TEMPLATES);
