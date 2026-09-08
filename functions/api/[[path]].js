const getBackendOrigin = (env) => {
  const backendOrigin = (env.BACKEND_ORIGIN || "").trim().replace(/\/+$/, "");

  if (!/^https?:\/\//.test(backendOrigin)) {
    return null;
  }

  return backendOrigin;
};

export const onRequest = async ({ env, params, request }) => {
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
  const path = Array.isArray(params.path)
    ? params.path.join("/")
    : params.path || "";
  const backendUrl = new URL(`/api/${path}`, backendOrigin);
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
