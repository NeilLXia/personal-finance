import { normalizeDashboardData } from "./shared/dashboardDataUtils";
import type { DashboardData } from "./shared/types";
import {
  getJson,
  postJson,
  postJsonWithoutBody,
  postUrlEncoded,
} from "../../shared/apiClient";

export { getResponseErrorMessage } from "../../shared/apiClient";

type LinkTokenResponse = {
  link_token?: string;
};

export const logoutUser = async () => {
  await postJsonWithoutBody("/api/logout", {}, "Logout failed");
};

export const createLinkToken = async (plaidItemId?: string) =>
  postJson<LinkTokenResponse>(
    "/api/create_link_token",
    plaidItemId ? { plaid_item_id: plaidItemId } : undefined,
    {},
    plaidItemId ? "Reconnect failed" : "Link token request failed",
  );

export const exchangePublicToken = async (publicToken: string) => {
  await postUrlEncoded(
    "/api/set_access_token",
    new URLSearchParams({ public_token: publicToken }),
    {},
    "Plaid token exchange failed",
  );
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

export const fetchDashboardIncomeAllocation = async (
  searchParams: URLSearchParams,
  options: RequestInit = {},
): Promise<Pick<DashboardData, "income_allocation">> =>
  getJson<Pick<DashboardData, "income_allocation">>(
    `/api/dashboard/income-allocation?${searchParams.toString()}`,
    options,
    "Income allocation request failed",
  );

export const fetchDashboardTransactions = async (
  searchParams: URLSearchParams,
  options: RequestInit = {},
): Promise<
  Pick<
    DashboardData,
    | "latest_transactions"
    | "payslips"
    | "transaction_categories"
    | "transaction_range"
  >
> =>
  getJson<
    Pick<
      DashboardData,
      | "latest_transactions"
      | "payslips"
      | "transaction_categories"
      | "transaction_range"
    >
  >(
    `/api/dashboard/transactions?${searchParams.toString()}`,
    options,
    "Transaction range request failed",
  );

export const refreshAllPlaidData = async () => {
  const refreshPaths = [
    "/api/account-balance-snapshots/refresh",
    "/api/transactions/sync",
  ];

  for (const path of refreshPaths) {
    await postJsonWithoutBody(path, {}, "Refresh failed");
  }
};
