import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0, // 1 retry in CI, 0 locally
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:5173',
    trace: process.env.CI ? 'on-first-retry' : 'retain-on-failure', // Optimize CI trace size
    video: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  // webServer: Preview build (not dev) for stability and speed
  // Recommended: reuseExistingServer true locally, false in CI
  webServer: {
    command: 'pnpm build && pnpm preview --port 5173',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI, // Reuse local, restart in CI
    timeout: 180_000, // 3min for build + preview startup
  },
});
