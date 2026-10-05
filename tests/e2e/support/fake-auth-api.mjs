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
const CLEARED_COOKIES = [
  "campus_session=; Path=/; HttpOnly; Max-Age=0",
  "campus_refresh=; Path=/v1/auth; HttpOnly; Max-Age=0",
];

// Unscripted invite reads answer with this live invite, so tests that only
// need /preview to render do not have to script it.
const PENDING_INVITE = {
  id: "66666666-6666-4666-8666-666666666666",
  cohort: { id: "c-3", name: "Cohort 3", code: "C3", status: "active" },
  cohortTrack: null,
  track: null,
  cohortRole: "student",
  systemRole: "user",
  status: "pending",
  expiresAt: "2099-01-01T00:00:00.000Z",
  guestAccessExpiresAt: null,
  invitedBy: { id: "inviter-1", firstName: "Ejemen", lastName: "Iboi" },
  createdAt: "2026-09-30T19:58:13.565Z",
  user: {
    id: "55555555-5555-4555-8555-555555555555",
    email: "ada@campus.local",
    firstName: "Ada",
    lastName: "Lovelace",
    displayName: "Ada Lovelace",
    systemRole: "user",
    status: "active",
  },
};
const FULL_ACCESS_COOKIES = [
  "campus_session=full-access-session; Path=/; HttpOnly",
  "campus_refresh=full-access-refresh; Path=/v1/auth; HttpOnly",
];

let refreshReplies = [];
let logoutReplies = [];
let sessionReply;
let cohortPages = {};
let previewReply;
let pendingInviteReply;
let decisionReplies = [];
let sessionAfterAccept;
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

// Unscripted logouts succeed: most tests only need the session to end.
function replyToLogout(response) {
  const reply = logoutReplies.shift();
  if (reply && reply.status !== 204) {
    sendScripted(response, reply);
    return;
  }

  response.writeHead(204, { "set-cookie": CLEARED_COOKIES });
  response.end();
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

function replyToPreview(response) {
  if (!previewReply) {
    sendJson(response, 503, { error: { code: "UNSCRIPTED_PREVIEW" } });
    return;
  }
  sendScripted(response, previewReply);
}

function replyToPendingInvite(request, response) {
  if (!hasSessionCookie(request)) {
    sendJson(response, 401, { error: { code: "UNAUTHORIZED" } });
    return;
  }
  sendScripted(
    response,
    pendingInviteReply ?? { status: 200, body: PENDING_INVITE },
  );
}

// A successful accept upgrades the session, as campus-api does: full-access
// cookies, and from then on the session read answers with sessionAfterAccept.
function replyToDecision(response) {
  const reply = decisionReplies.shift();
  if (!reply) {
    sendJson(response, 500, { error: { code: "UNSCRIPTED_DECISION" } });
    return;
  }
  if (reply.status !== 200) {
    sendScripted(response, reply);
    return;
  }

  if (sessionAfterAccept) sessionReply = sessionAfterAccept;
  response.writeHead(200, {
    "content-type": "application/json",
    "set-cookie": FULL_ACCESS_COOKIES,
  });
  response.end(JSON.stringify(reply.body));
}

// Each key present in the body replaces that part of the scenario, so tests
// can script the refresh, session, cohort, and invite replies independently.
function applyScenario(scenario) {
  if ("refresh" in scenario) refreshReplies = scenario.refresh;
  if ("logout" in scenario) logoutReplies = scenario.logout;
  if ("session" in scenario) sessionReply = scenario.session;
  if ("cohorts" in scenario) cohortPages = scenario.cohorts;
  if ("preview" in scenario) previewReply = scenario.preview;
  if ("pendingInvite" in scenario) pendingInviteReply = scenario.pendingInvite;
  if ("decision" in scenario) decisionReplies = scenario.decision;
  if ("sessionAfterAccept" in scenario) {
    sessionAfterAccept = scenario.sessionAfterAccept;
  }
}

async function handleControl(request, response, path) {
  if (path === "/__health") return sendJson(response, 200, { status: "ok" });
  if (path === "/__requests") return sendJson(response, 200, requests);
  if (path === "/__reset") {
    refreshReplies = [];
    logoutReplies = [];
    sessionReply = undefined;
    cohortPages = {};
    previewReply = undefined;
    pendingInviteReply = undefined;
    decisionReplies = [];
    sessionAfterAccept = undefined;
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
    body: request.method === "POST" ? await readBody(request) : "",
  });

  if (request.method === "POST" && path === "/v1/auth/refresh") {
    replyToRefresh(response);
    return;
  }

  if (request.method === "POST" && path === "/v1/auth/logout") {
    replyToLogout(response);
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

  if (request.method === "POST" && path === "/v1/invites/preview") {
    replyToPreview(response);
    return;
  }

  if (request.method === "GET" && path === "/v1/invites/validate-user-invite") {
    replyToPendingInvite(request, response);
    return;
  }

  if (request.method === "POST" && path === "/v1/invites/decision") {
    replyToDecision(response);
    return;
  }

  sendJson(response, 401, { error: { code: "UNAUTHENTICATED" } });
});

server.listen(port, "127.0.0.1");
