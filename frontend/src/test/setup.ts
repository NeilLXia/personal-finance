import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// Unmount anything rendered by a test so React Query providers, timers and DOM
// nodes don't leak into the next one.
afterEach(() => {
  cleanup();
});
