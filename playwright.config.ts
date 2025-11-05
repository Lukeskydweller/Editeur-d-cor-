import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "e2e",
  timeout: 30_000,
  use: {
    baseURL: "http://localhost:5173",
    trace: "retain-on-failure",
    video: "retain-on-failure",
    screenshot: "only-on-failure"
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  // Démarre le DEV SERVER Vite (ne bloque pas sur les erreurs TS)
  webServer: {
    command: "pnpm dev -- --host --port 5173",
    url: "http://localhost:5173",
    reuseExistingServer: true,
    timeout: 90_000
  }
});
