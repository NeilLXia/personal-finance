import { proxyApiRequest } from "./functions/_proxy-backend.js";

export default {
  fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname.startsWith("/api/")) {
      return proxyApiRequest(request, env);
    }

    return env.ASSETS.fetch(request);
  },
};
