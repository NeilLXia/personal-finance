const getBackendOrigin = (env) => {
  const backendOrigin = (env.BACKEND_ORIGIN || "").trim().replace(/\/+$/, "");

  if (!/^https?:\/\//.test(backendOrigin)) {
    return null;
  }

  return backendOrigin;
};

const getBackendTimeoutMs = (env) => {
  const timeoutMs = Number(env.BACKEND_TIMEOUT_MS);

  return Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 10000;
};

const proxyApiRequest = async (request, env) => {
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
  const backendOriginUrl = new URL(backendOrigin);

  if (backendOriginUrl.host === requestUrl.host) {
    return Response.json(
      {
        error:
          "BACKEND_ORIGIN must point to the backend origin, not this frontend Worker domain.",
      },
      { status: 500 },
    );
  }

  const backendUrl = new URL(requestUrl.pathname, backendOrigin);
  const headers = new Headers(request.headers);
  const abortController = new AbortController();
  const timeout = setTimeout(
    () => abortController.abort(),
    getBackendTimeoutMs(env),
  );

  backendUrl.search = requestUrl.search;
  headers.delete("host");

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

export default {
  fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname.startsWith("/api/")) {
      return proxyApiRequest(request, env);
    }

    return env.ASSETS.fetch(request);
  },
};
