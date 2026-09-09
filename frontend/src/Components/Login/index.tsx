import { useCallback, useEffect, useRef, useState } from "react";

import { useAppContext } from "../../Context";
import type { AuthUser } from "../../Context";
import { postJson } from "../../shared/apiClient";
import styles from "./index.module.css";

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential?: string }) => void;
          }) => void;
          renderButton: (
            element: HTMLElement,
            options: {
              theme: string;
              size: string;
              width: number;
              text: string;
            },
          ) => void;
        };
      };
    };
  }
}

type LoginProps = {
  onAuthenticated: () => Promise<void>;
};

type LoginResponse = {
  user: AuthUser;
};

const googleScriptId = "google-identity-services";
let initializedGoogleClientId: string | null = null;
let googleCredentialHandler:
  ((response: { credential?: string }) => Promise<void>) | null = null;

const Login = ({ onAuthenticated }: LoginProps) => {
  const { googleClientId, dispatch } = useAppContext();
  const googleButtonRef = useRef<HTMLDivElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDemoLoading, setIsDemoLoading] = useState(false);

  const completeLogin = useCallback(
    async (data: LoginResponse) => {
      dispatch({
        type: "AUTHENTICATED",
        authUser: data.user,
      });
      await onAuthenticated();
    },
    [dispatch, onAuthenticated],
  );

  useEffect(() => {
    if (!googleClientId || !googleButtonRef.current) {
      return;
    }

    googleCredentialHandler = async ({ credential }) => {
      if (!credential) {
        setError("Google did not return a sign-in credential.");
        return;
      }

      setError(null);
      try {
        const data = await postJson<LoginResponse>(
          "/api/login/google",
          { credential },
          {},
          "Google sign-in failed",
        );
        await completeLogin(data);
      } catch (requestError) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Google sign-in failed.",
        );
      }
    };

    const renderGoogleButton = () => {
      if (!window.google || !googleButtonRef.current) {
        return;
      }

      googleButtonRef.current.innerHTML = "";
      if (initializedGoogleClientId !== googleClientId) {
        window.google.accounts.id.initialize({
          client_id: googleClientId,
          callback: (response) => {
            void googleCredentialHandler?.(response);
          },
        });
        initializedGoogleClientId = googleClientId;
      }
      window.google.accounts.id.renderButton(googleButtonRef.current, {
        theme: "outline",
        size: "large",
        width: 280,
        text: "signin_with",
      });
    };

    if (window.google) {
      renderGoogleButton();
      return () => {
        googleCredentialHandler = null;
      };
    }

    const existingScript = document.getElementById(googleScriptId);
    if (existingScript) {
      existingScript.addEventListener("load", renderGoogleButton, {
        once: true,
      });
      return () => {
        existingScript.removeEventListener("load", renderGoogleButton);
        googleCredentialHandler = null;
      };
    }

    const script = document.createElement("script");
    script.id = googleScriptId;
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = renderGoogleButton;
    script.onerror = () => setError("Google sign-in could not be loaded.");
    document.head.appendChild(script);
    return () => {
      script.onload = null;
      script.onerror = null;
      googleCredentialHandler = null;
    };
  }, [completeLogin, googleClientId]);

  const viewDemo = async () => {
    setIsDemoLoading(true);
    setError(null);

    try {
      const data = await postJson<LoginResponse>(
        "/api/login/demo",
        undefined,
        {},
        "Demo sign-in failed",
      );
      await completeLogin(data);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Demo sign-in failed.",
      );
    } finally {
      setIsDemoLoading(false);
    }
  };

  return (
    <main className={styles.login}>
      <section className={styles.panel}>
        <p className={styles.eyebrow}>Expense tracker</p>
        <h1>Personal Finance</h1>
        <div className={styles.actions}>
          {googleClientId ? (
            <div ref={googleButtonRef} className={styles.googleButton} />
          ) : (
            <div className={styles.notice}>
              Set GOOGLE_CLIENT_ID to enable Google login.
            </div>
          )}
          <button
            type="button"
            className={styles.demoButton}
            onClick={viewDemo}
            disabled={isDemoLoading}
          >
            {isDemoLoading ? "Loading demo" : "View as demo user"}
          </button>
        </div>
        {error && <div className={styles.alert}>{error}</div>}
      </section>
    </main>
  );
};

export default Login;
