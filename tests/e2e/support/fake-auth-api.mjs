// Local stand-in for campus-api during Playwright runs. The Next.js proxy calls
// it server-side, which page.route cannot intercept. Tests script responses
// through the /__ control endpoints; everything else is logged.
import { createServer } from "node:http";

const port = Number(process.env.FAKE_API_PORT ?? 3101);

const REFRESHED_BODY = JSON.stringify({
  expiresAt: "2099-01-01T00:15:00.000Z",
  refreshExpiresAt: "2099-01-31T00:00:00.000Z",
});
const ROTATED_COOKIES = [
  "campus_session=rotated-session; Path=/; HttpOnly",
  "campus_refresh=rotated-refresh; Path=/v1/auth; HttpOnly",
];

let refreshReplies = [];
let sessionReply;
let cohortPages = {};
let requests = [];

function sendJson(response, status, body, headers = {}) {
  response.writeHead(status, {
    "content-type": "application/json",
    ...headers,
  });
  response.end(body === undefined ? undefined : JSON.stringify(body));
}

function sendScripted(response, reply) {
  sendJson(
    response,
    reply.status,
    reply.body ?? { error: { code: "SCRIPTED" } },
    reply.headers,
  );
}

function readBody(request) {
  return new Promise((resolve) => {
    let body = "";
    request.on("data", (chunk) => (body += chunk));
    request.on("end", () => resolve(body));
  });
}

function hasSessionCookie(request) {
  return (request.headers.cookie ?? "")
    .split(";")
    .some((cookie) => cookie.trim().startsWith("campus_session="));
}

function replyToRefresh(response) {
  const reply = refreshReplies.shift();
  if (!reply) {
    sendJson(response, 500, { error: { code: "UNSCRIPTED_REFRESH" } });
    return;
  }

  if (reply.status === 200) {
    response.writeHead(200, {
      "content-type": "application/json",
      "set-cookie": ROTATED_COOKIES,
    });
    response.end(REFRESHED_BODY);
    return;
  }

  sendScripted(response, reply);
}

function replyToSession(request, response) {
  if (!sessionReply || !hasSessionCookie(request)) {
    sendJson(response, 401, { error: { code: "UNAUTHENTICATED" } });
    return;
  }
  sendScripted(response, sessionReply);
}

function replyToCohorts(url, response) {
  const page = cohortPages[url.searchParams.get("page") ?? "1"];
  if (!page) {
    sendJson(response, 503, { error: { code: "UNSCRIPTED_COHORT_PAGE" } });
    return;
  }
  sendJson(response, 200, page);
}

// Each key present in the body replaces that part of the scenario, so tests
// can script the refresh, session, and cohort replies independently.
function applyScenario(scenario) {
  if ("refresh" in scenario) refreshReplies = scenario.refresh;
  if ("session" in scenario) sessionReply = scenario.session;
  if ("cohorts" in scenario) cohortPages = scenario.cohorts;
}

async function handleControl(request, response, path) {
  if (path === "/__health") return sendJson(response, 200, { status: "ok" });
  if (path === "/__requests") return sendJson(response, 200, requests);
  if (path === "/__reset") {
    refreshReplies = [];
    sessionReply = undefined;
    cohortPages = {};
    requests = [];
    return sendJson(response, 204);
  }
  if (path === "/__scenario" && request.method === "POST") {
    applyScenario(JSON.parse(await readBody(request)));
    return sendJson(response, 204);
  }
  return sendJson(response, 404, { error: { code: "UNKNOWN_CONTROL" } });
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", "http://fake-api");
  const path = url.pathname;

  if (path.startsWith("/__")) {
    await handleControl(request, response, path);
    return;
  }

  requests.push({
    method: request.method,
    path,
    search: url.search,
    cookie: request.headers.cookie ?? null,
  });

  if (request.method === "POST" && path === "/v1/auth/refresh") {
    replyToRefresh(response);
    return;
  }

  if (request.method === "GET" && path === "/v1/auth/me") {
    replyToSession(request, response);
    return;
  }

  if (request.method === "GET" && path === "/v1/cohorts") {
    replyToCohorts(url, response);
    return;
  }

  sendJson(response, 401, { error: { code: "UNAUTHENTICATED" } });
});

server.listen(port, "127.0.0.1");
