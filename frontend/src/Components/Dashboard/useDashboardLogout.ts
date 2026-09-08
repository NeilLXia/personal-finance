import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { Dispatch } from "react";

import type { AppAction } from "../../Context";
import { logoutUser } from "./dashboardApi";
import { LINK_TOKEN_STORAGE_KEY } from "./shared/constants";

export const useDashboardLogout = (dispatch: Dispatch<AppAction>) => {
  const queryClient = useQueryClient();

  return useCallback(async () => {
    await logoutUser();
    queryClient.clear();
    localStorage.removeItem(LINK_TOKEN_STORAGE_KEY);
    dispatch({
      type: "AUTH_EXPIRED",
    });
  }, [dispatch, queryClient]);
};
