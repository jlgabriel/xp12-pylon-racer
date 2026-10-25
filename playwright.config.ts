import { defineConfig } from "@playwright/test";

// Each spec launches the BUILT Electron app via _electron, so there are no browser projects here.
// `npm run test:e2e` builds first; `npx playwright test` alone would test stale bytes.
export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.spec.ts",
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 12_000 },
  forbidOnly: !!process.env["CI"],
  reporter: [["list"]],
});
