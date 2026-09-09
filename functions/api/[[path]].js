import { proxyApiRequest } from "../../frontend/functions/_proxy-backend.js";

// Repo-root Pages Functions entry, used when the Cloudflare Pages project root is
// the repository root instead of frontend/. Shares frontend/functions/
// _proxy-backend.js so the two entries can't drift.
export const onRequest = ({ env, request }) => proxyApiRequest(request, env);
