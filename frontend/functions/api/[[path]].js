import { proxyApiRequest } from "../_proxy-backend.js";

export const onRequest = ({ env, request }) => proxyApiRequest(request, env);
