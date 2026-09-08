import { useEffect, useRef, useState } from "react";

import { ApiError, getJson } from "../../../shared/apiClient";

export type AddressSuggestion = {
  id: string;
  label: string;
  address: string;
  city: string | null;
  region: string | null;
  postal_code: string | null;
  country: string | null;
  source: "mapbox";
};

type AddressSuggestionsResponse = {
  suggestions?: AddressSuggestion[];
};

const MIN_QUERY_LENGTH = 3;
const DEBOUNCE_MS = 250;

const createSearchSessionToken = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

/**
 * Debounced Mapbox address autocomplete. Owns the request lifecycle (debounce,
 * abort, session token, status text) so `RealEstateModal` only deals with the
 * results and the menu open/closed UI state.
 */
export const useAddressSuggestions = (query: string, enabled: boolean) => {
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [status, setStatus] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const sessionToken = useRef(createSearchSessionToken());

  const trimmedQuery = query.trim();

  useEffect(() => {
    if (!enabled || trimmedQuery.length < MIN_QUERY_LENGTH) {
      setSuggestions([]);
      setStatus("");
      setIsSearching(false);
      return;
    }

    const controller = new AbortController();
    const debounce = window.setTimeout(() => {
      setIsSearching(true);
      setStatus("");

      const params = new URLSearchParams({
        query: trimmedQuery,
        session_token: sessionToken.current,
      });

      getJson<AddressSuggestionsResponse>(
        `/api/address-suggestions?${params.toString()}`,
        { signal: controller.signal },
        "Address search failed",
      )
        .then((data) => {
          const nextSuggestions = data.suggestions || [];

          setSuggestions(nextSuggestions);
          setStatus(
            nextSuggestions.length === 0 ? "No matching addresses found." : "",
          );
        })
        .catch((requestError) => {
          if (controller.signal.aborted) {
            return;
          }

          setSuggestions([]);
          setStatus(
            requestError instanceof ApiError && requestError.status === 400
              ? "Address search is not configured."
              : "Address search is unavailable.",
          );
        })
        .finally(() => {
          if (!controller.signal.aborted) {
            setIsSearching(false);
          }
        });
    }, DEBOUNCE_MS);

    return () => {
      window.clearTimeout(debounce);
      controller.abort();
    };
  }, [enabled, trimmedQuery]);

  return { suggestions, status, isSearching };
};
