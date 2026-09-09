import { useCallback, useEffect, useState } from "react";

export type ThemePreference = "light" | "dark";

const STORAGE_KEY = "theme";

/** The stored choice, or the OS preference to seed the first visit, or light. */
const resolveInitialPreference = (): ThemePreference => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "light" || stored === "dark") {
      return stored;
    }
  } catch {
    /* storage unavailable — fall through to the OS preference */
  }

  const prefersDark =
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches;

  return prefersDark ? "dark" : "light";
};

/**
 * Reflect the preference onto <html data-theme> and localStorage. Mirrors the
 * pre-paint bootstrap script in public/theme-init.js.
 */
const applyPreference = (preference: ThemePreference) => {
  document.documentElement.dataset.theme = preference;

  try {
    localStorage.setItem(STORAGE_KEY, preference);
  } catch {
    /* storage unavailable — the attribute is still set for this session */
  }
};

export const useTheme = () => {
  const [theme, setTheme] = useState<ThemePreference>(resolveInitialPreference);

  useEffect(() => {
    applyPreference(theme);
  }, [theme]);

  const cycleTheme = useCallback(() => {
    setTheme((current) => (current === "dark" ? "light" : "dark"));
  }, []);

  return { theme, setTheme, cycleTheme };
};
