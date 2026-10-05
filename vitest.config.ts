import { defineConfig } from 'vitest/config';
import path from 'path';
import { testDbPath } from './vitest.global-setup';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  test: {
    globalSetup: ['vitest.global-setup.ts'],
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'e2e/**/*.test.ts'],
    // Order matters: the per-worker DB path must be set before anything can import `db.ts`.
    setupFiles: ['vitest.worker-env.ts', 'src/__tests__/setup.ts'],
    // The 5 s default is a laptop-idle number: the full suite runs ~1800 jsdom files on 16
    // workers, where a slow-but-correct test (a synchronous `src/` walk, a first DB bootstrap, a
    // large layout-lab render) routinely needs more and timed out only under that load. 30 s keeps
    // a real hang failing in well under a minute without flaking on contention.
    testTimeout: 30_000,
    hookTimeout: 30_000,
    environment: 'jsdom',
    // THE containment floor: `src/lib/db.ts` reads `POF_DB_PATH || ~/.pof/pof.db`, so a suite
    // that touches SQLite without opting into an override wrote into the operator's real
    // database — and 42% of `pipeline_artifacts` was test residue as a result. `test.env` is
    // applied to each worker before it loads a single module, so no import order can race it
    // (`vitest.worker-env.ts` then narrows this to one file per worker; it is the first
    // `setupFiles` entry, which runs before the test file's imports.)
    // A file with its own `vi.hoisted` override still wins; this is the floor, not a ceiling.
    // The paired guard in the global setup fails the run if a fixture row reaches the real DB
    // anyway. See `vitest.global-setup.ts`.
    env: { POF_DB_PATH: testDbPath() },
  },
});
