import { proxyApiRequest } from "../../frontend/functions/_proxy-backend.js";

export const onRequest = ({ env, request }) => proxyApiRequest(request, env);
