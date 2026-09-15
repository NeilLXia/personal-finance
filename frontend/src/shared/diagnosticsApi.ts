import { getJson } from "./apiClient";

export type HealthCheckResult = {
  backend: { status: string };
  database: { status: string; latency_ms: number };
};

export const checkHealth = () =>
  getJson<{ status: string }>("/health/ready", {}, "Health check failed").then(
    (result) => ({
      backend: { status: "ok" },
      database: {
        status: result.status === "ready" ? "ok" : result.status,
        latency_ms: 0,
      },
    }),
  );
