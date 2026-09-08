const getBackendOrigin = (env) => {
  const backendOrigin = (env.BACKEND_ORIGIN || "").trim().replace(/\/+$/, "");

  if (!/^https?:\/\//.test(backendOrigin)) {
    throw new Error("BACKEND_ORIGIN must be an absolute http(s) URL");
  }

  return backendOrigin;
};

export const onRequest = async ({ env, params, request }) => {
  const backendOrigin = getBackendOrigin(env);
  const requestUrl = new URL(request.url);
  const path = Array.isArray(params.path)
    ? params.path.join("/")
    : params.path || "";
  const backendUrl = new URL(`/api/${path}`, backendOrigin);
  const headers = new Headers(request.headers);

  backendUrl.search = requestUrl.search;
  headers.delete("host");

  return fetch(
    new Request(backendUrl, {
      body: request.method === "GET" || request.method === "HEAD"
        ? undefined
        : request.body,
      headers,
      method: request.method,
      redirect: "manual",
    }),
  );
};
