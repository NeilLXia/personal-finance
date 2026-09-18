import React, { useEffect, useCallback } from "react";

import Dashboard from "./Components/Dashboard";
import Login from "./Components/Login";
import { useAppContext } from "./Context";
import type { AuthUser } from "./Context";
import {
  addAuthExpiredListener,
  getJson,
  postJson,
} from "./shared/apiClient";

import styles from "./App.module.css";

type LinkTokenResponse = {
  error?: { error_message?: string } | null;
  link_token?: string;
};

type SessionResponse = {
  authenticated: boolean;
  google_client_id: string | null;
  user: AuthUser | null;
};

const getStoredLinkToken = () => {
  try {
    return localStorage.getItem("link_token");
  } catch {
    return null;
  }
};

const setStoredLinkToken = (linkToken: string) => {
  try {
    localStorage.setItem("link_token", linkToken);
  } catch {
    // Plaid OAuth can continue in memory if browser storage is unavailable.
  }
};

const removeStoredLinkToken = () => {
  try {
    localStorage.removeItem("link_token");
  } catch {
    // Ignore storage errors during auth cleanup.
  }
};

const App = () => {
  const { authUser, isSessionLoading, dispatch } = useAppContext();

  const generateToken = useCallback(
    async () => {
      try {
        const data = await postJson<LinkTokenResponse>(
          "/api/create_link_token",
          undefined,
          {},
          "Link token request failed",
        );

        if (data.error != null || typeof data.link_token !== "string") {
          dispatch({ type: "SET_LINK_TOKEN", linkToken: null });
          return;
        }

        dispatch({ type: "SET_LINK_TOKEN", linkToken: data.link_token });
        setStoredLinkToken(data.link_token);
      } catch {
        dispatch({ type: "SET_LINK_TOKEN", linkToken: null });
      }
    },
    [dispatch]
  );

  useEffect(() => {
    const init = async () => {
      try {
        const session = await getJson<SessionResponse>(
          "/api/session",
          {},
          "Session request failed",
        );
        dispatch({
          type: "SESSION_LOADED",
          authUser: session.authenticated ? session.user : null,
          googleClientId: session.google_client_id,
        });

        if (!session.authenticated) {
          return;
        }

        // do not generate a new token for OAuth redirect; instead
        // setLinkToken from localStorage
        if (window.location.href.includes("?oauth_state_id=")) {
          dispatch({
            type: "SET_LINK_TOKEN",
            linkToken: getStoredLinkToken(),
          });
          return;
        }

        generateToken();
      } catch {
        dispatch({
          type: "SESSION_LOADED",
          authUser: null,
          googleClientId: null,
        });
      }
    };
    init();
  }, [dispatch, generateToken]);

  useEffect(() =>
    addAuthExpiredListener(() => {
      removeStoredLinkToken();
      dispatch({ type: "AUTH_EXPIRED" });
    }),
  [dispatch]);

  const loadAuthenticatedApp = useCallback(async () => {
    await generateToken();
  }, [generateToken]);

  return (
    <div className={styles.App}>
      {isSessionLoading ? (
        <div className={styles.loading}>Loading</div>
      ) : !authUser ? (
        <Login onAuthenticated={loadAuthenticatedApp} />
      ) : (
        <div className={styles.container}>
          <Dashboard />
        </div>
      )}
    </div>
  );
};

export default App;
