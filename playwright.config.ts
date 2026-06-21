import { defineConfig, devices } from '@playwright/test';

const PORT = process.env.PLAYWRIGHT_PORT ?? '3000';
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: 'html',
  timeout: 30_000,
  // Runs once: assert the server under test is actually PoF (not a stray dev server on the
  // port) + warm the heavy /layout compile. Fails fast with one actionable error instead of
  // N silent harness-lab-ready timeouts against the wrong app.
  globalSetup: './e2e/global-setup.ts',

  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: {
    command: `npm run dev -- -p ${PORT}`,
    url: BASE_URL,
    // Reuse a local dev server for fast iteration, but in CI always start a fresh PoF server
    // so a leftover/wrong process can't be silently adopted.
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
