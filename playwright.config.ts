import { defineConfig, devices } from '@playwright/test';
import { E2E_DB_PATH, resetE2eDb } from './e2e/helpers/e2e-db';

const PORT = process.env.PLAYWRIGHT_PORT ?? '3000';
const BASE_URL = `http://localhost:${PORT}`;

// Wipe the throwaway SQLite file BEFORE Playwright launches `webServer` (this module is
// evaluated first), so the suite always grades against an empty DB instead of whatever
// judge verdicts / drain outcomes / artifacts happen to live in the developer's
// ~/.pof/pof.db. See e2e/helpers/e2e-db.ts.
resetE2eDb();

// Reusing an already-running dev server is a HERMETICITY HOLE: that process was started
// without POF_DB_PATH, so the suite would silently grade against the real DB again. It is
// therefore opt-in (POF_E2E_REUSE_SERVER=1) for hand-driven iteration only, and never the
// default — including locally, where the non-reproducible result did the most damage.
const REUSE_SERVER = process.env.POF_E2E_REUSE_SERVER === '1';

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
    // Every context starts from a completed project (written by global-setup) so the
    // project-gated homepage (`/`) renders the lab — the specs target the lab, not the
    // first-run setup flow. The file is regenerated each run and gitignored.
    storageState: './e2e/.auth/project-seeded.json',
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
    // Fresh server by default so the run OWNS its process and therefore its database (see
    // REUSE_SERVER above). If the port is busy Playwright fails loudly rather than adopting
    // a foreign process.
    reuseExistingServer: REUSE_SERVER,
    // The server under test runs on the throwaway e2e DB, never ~/.pof/pof.db.
    env: { POF_DB_PATH: E2E_DB_PATH },
    // A cold worktree compiles the app on first boot; 60s was tight enough to fail as a
    // confusing "PoF lab not detected".
    timeout: 180_000,
  },
});
