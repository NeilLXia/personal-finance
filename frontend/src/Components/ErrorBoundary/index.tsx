import { Component } from "react";
import type { ErrorInfo, ReactNode } from "react";

import styles from "./index.module.css";

type ErrorBoundaryProps = {
  children: ReactNode;
};

type ErrorBoundaryState = {
  hasError: boolean;
};

// Top-level guard so an uncaught render error shows a recoverable screen instead
// of a blank page. Wrap the whole tree in src/index.tsx.
class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Keep the stack in the console for local debugging. Swap this for a real
    // reporter (Sentry, etc.) when one is wired up.
    console.error("Unhandled render error", error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className={styles.fallback} role="alert">
        <div className={styles.card}>
          <h1 className={styles.title}>Something went wrong</h1>
          <p className={styles.body}>
            The app hit an unexpected error. Reloading usually fixes it.
          </p>
          <button
            type="button"
            className={styles.button}
            onClick={this.handleReload}
          >
            Reload
          </button>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
