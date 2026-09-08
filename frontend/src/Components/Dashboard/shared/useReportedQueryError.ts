import { useEffect } from "react";

export const getErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

/**
 * Forwards a react-query error to an imperative error sink (typically a modal's
 * `onError` prop). Replaces the near-identical `useEffect(() => { if (q.error)
 * onError(...) })` block that each modal used to hand-roll.
 */
export const useReportedQueryError = (
  error: unknown,
  fallback: string,
  onError: (message: string) => void,
) => {
  useEffect(() => {
    if (error) {
      onError(getErrorMessage(error, fallback));
    }
  }, [error, fallback, onError]);
};
