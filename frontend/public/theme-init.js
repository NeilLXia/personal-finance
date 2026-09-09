// Applies the saved theme before first paint to avoid a flash. Loaded as a
// blocking classic script from <head> so it runs before the body renders, which
// lets the Content-Security-Policy keep script-src at 'self' with no inline
// exception.
try {
  var stored = localStorage.getItem("theme");
  if (stored === "light" || stored === "dark") {
    document.documentElement.dataset.theme = stored;
  }
} catch {
  // Ignore storage access errors (private mode, storage disabled).
}
