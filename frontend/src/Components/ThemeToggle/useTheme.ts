import { useCallback, useState } from "react";

export type ThemePreference = "system" | "light" | "dark";

const STORAGE_KEY = "theme";
const ORDER: ThemePreference[] = ["system", "light", "dark"];

const readStored = (): ThemePreference => {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === "light" || value === "dark" ? value : "system";
  } catch {
    return "system";
  }
};

/**
 * Reflect the preference onto <html data-theme> and localStorage. "system"
 * removes the attribute so tokens.css falls back to prefers-color-scheme.
 * Mirrors the inline bootstrap script in index.html.
 */
const applyPreference = (preference: ThemePreference) => {
  const root = document.documentElement;

  if (preference === "system") {
    delete root.dataset.theme;
  } else {
    root.dataset.theme = preference;
  }

  try {
    if (preference === "system") {
      localStorage.removeItem(STORAGE_KEY);
    } else {
      localStorage.setItem(STORAGE_KEY, preference);
    }
  } catch {
    /* storage unavailable — the attribute is still set for this session */
  }
};

export const useTheme = () => {
  const [theme, setThemeState] = useState<ThemePreference>(readStored);

  const setTheme = useCallback((preference: ThemePreference) => {
    applyPreference(preference);
    setThemeState(preference);
  }, []);

  const cycleTheme = useCallback(() => {
    setThemeState((current) => {
      const next = ORDER[(ORDER.indexOf(current) + 1) % ORDER.length];
      applyPreference(next);
      return next;
    });
  }, []);

  return { theme, setTheme, cycleTheme };
};
