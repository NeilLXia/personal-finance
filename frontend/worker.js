const getBackendOrigin = (env) => {
  const backendOrigin = (env.BACKEND_ORIGIN || "").trim().replace(/\/+$/, "");

  if (!/^https?:\/\//.test(backendOrigin)) {
    return null;
  }

  return backendOrigin;
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
  const backendUrl = new URL(requestUrl.pathname, backendOrigin);
  const headers = new Headers(request.headers);

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
      }),
    );
  } catch {
    return Response.json(
      {
        error: "Unable to reach backend origin.",
        backend_origin: backendOrigin,
      },
      { status: 502 },
    );
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
