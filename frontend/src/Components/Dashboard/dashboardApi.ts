import { normalizeDashboardData } from "./shared/dashboardDataUtils";
import type { DashboardData } from "./shared/types";
import {
  getJson,
  postJsonWithoutBody,
} from "../../shared/apiClient";

export { getResponseErrorMessage } from "../../shared/apiClient";

export const logoutUser = async () => {
  await postJsonWithoutBody("/api/logout", {}, "Logout failed");
};

export const fetchDashboard = async (
  searchParams: URLSearchParams,
  errorContext = "Dashboard",
  options: RequestInit = {},
): Promise<DashboardData> => {
  const data = await getJson<DashboardData>(
    `/api/dashboard?${searchParams.toString()}`,
    options,
    `${errorContext} request failed`,
  );

  return normalizeDashboardData(data);
};

export const refreshAllPlaidData = async () => {
  const refreshPaths = [
    "/api/account-balance-snapshots/refresh",
    "/api/transactions/sync",
  ];

  for (const path of refreshPaths) {
    await postJsonWithoutBody(path, {}, "Refresh failed");
  }
};
