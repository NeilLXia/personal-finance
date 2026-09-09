// Applies the theme before first paint to avoid a flash. Loaded as a blocking
// classic script from <head> so it runs before the body renders, which lets the
// Content-Security-Policy keep script-src at 'self' with no inline exception.
// Mirrors resolveInitialPreference() in useTheme.ts.
try {
  var stored = localStorage.getItem("theme");
  if (stored === "light" || stored === "dark") {
    document.documentElement.dataset.theme = stored;
  } else {
    var prefersDark =
      window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches;
    document.documentElement.dataset.theme = prefersDark ? "dark" : "light";
  }
} catch {
  document.documentElement.dataset.theme = "light";
}
