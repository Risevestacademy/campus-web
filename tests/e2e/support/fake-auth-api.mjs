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
let requests = [];

function sendJson(response, status, body, headers = {}) {
  response.writeHead(status, {
    "content-type": "application/json",
    ...headers,
  });
  response.end(body === undefined ? undefined : JSON.stringify(body));
}

function readBody(request) {
  return new Promise((resolve) => {
    let body = "";
    request.on("data", (chunk) => (body += chunk));
    request.on("end", () => resolve(body));
  });
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

  sendJson(
    response,
    reply.status,
    { error: { code: "SCRIPTED" } },
    reply.headers,
  );
}

async function handleControl(request, response, path) {
  if (path === "/__health") return sendJson(response, 200, { status: "ok" });
  if (path === "/__requests") return sendJson(response, 200, requests);
  if (path === "/__reset") {
    refreshReplies = [];
    requests = [];
    return sendJson(response, 204);
  }
  if (path === "/__scenario" && request.method === "POST") {
    refreshReplies = JSON.parse(await readBody(request)).refresh ?? [];
    return sendJson(response, 204);
  }
  return sendJson(response, 404, { error: { code: "UNKNOWN_CONTROL" } });
}

const server = createServer(async (request, response) => {
  const path = new URL(request.url ?? "/", "http://fake-api").pathname;

  if (path.startsWith("/__")) {
    await handleControl(request, response, path);
    return;
  }

  requests.push({
    method: request.method,
    path,
    cookie: request.headers.cookie ?? null,
  });

  if (request.method === "POST" && path === "/v1/auth/refresh") {
    replyToRefresh(response);
    return;
  }

  sendJson(response, 401, { error: { code: "UNAUTHENTICATED" } });
});

server.listen(port, "127.0.0.1");
