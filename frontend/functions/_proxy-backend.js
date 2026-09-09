// Single implementation of the `/api/*` → backend reverse proxy, shared by every
// deploy target so they can't drift:
//   - worker.js                        Cloudflare Workers static assets
//   - functions/api/[[path]].js        Pages Functions, project root = frontend/
//   - ../functions/api/[[path]].js     Pages Functions, project root = repo root
//
// BACKEND_ORIGIN comes from the Worker/Pages environment (a Cloudflare dashboard
// variable, or wrangler.jsonc `vars` for local `wrangler dev`) — never from a
// bundled .env file, which is not uploaded to Cloudflare.
//
// The leading underscore keeps Pages Functions from treating this file as a
// route.

const DEFAULT_BACKEND_TIMEOUT_MS = 10000;

const getBackendOrigin = (env) => {
  const backendOrigin = (env.BACKEND_ORIGIN || "").trim().replace(/\/+$/, "");

  return /^https?:\/\//.test(backendOrigin) ? backendOrigin : null;
};

const getBackendTimeoutMs = (env) => {
  const timeoutMs = Number(env.BACKEND_TIMEOUT_MS);

  return Number.isFinite(timeoutMs) && timeoutMs > 0
    ? timeoutMs
    : DEFAULT_BACKEND_TIMEOUT_MS;
};

export const proxyApiRequest = async (request, env) => {
  const backendOrigin = getBackendOrigin(env);

  if (!backendOrigin) {
    return Response.json(
      {
        error: "BACKEND_ORIGIN must be configured as an absolute http(s) URL.",
      },
      { status: 500 },
    );
  }

  const requestUrl = new URL(request.url);

  if (new URL(backendOrigin).host === requestUrl.host) {
    return Response.json(
      {
        error:
          "BACKEND_ORIGIN must point to the backend origin, not this frontend domain.",
      },
      { status: 500 },
    );
  }

  const backendUrl = new URL(requestUrl.pathname, backendOrigin);
  backendUrl.search = requestUrl.search;

  const headers = new Headers(request.headers);
  headers.delete("host");

  const abortController = new AbortController();
  const timeout = setTimeout(
    () => abortController.abort(),
    getBackendTimeoutMs(env),
  );

  try {
    return await fetch(
      new Request(backendUrl, {
        body:
          request.method === "GET" || request.method === "HEAD"
            ? undefined
            : request.body,
        headers,
        method: request.method,
        redirect: "manual",
        signal: abortController.signal,
      }),
    );
  } catch (error) {
    return Response.json(
      {
        error:
          error.name === "AbortError"
            ? "Backend origin timed out."
            : "Unable to reach backend origin.",
        backend_origin: backendOrigin,
      },
      { status: error.name === "AbortError" ? 504 : 502 },
    );
  } finally {
    clearTimeout(timeout);
  }
};
