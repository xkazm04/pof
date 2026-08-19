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
    setupFiles: ['src/__tests__/setup.ts'],
    environment: 'jsdom',
    // THE containment floor: `src/lib/db.ts` reads `POF_DB_PATH || ~/.pof/pof.db`, so a suite
    // that touches SQLite without opting into an override wrote into the operator's real
    // database — and 42% of `pipeline_artifacts` was test residue as a result. `test.env` is
    // applied to each worker before it loads a single module, so no import order can race it
    // (a `setupFiles` assignment can: `import '@/lib/db'` in the file under test runs first).
    // A file with its own `vi.hoisted` override still wins; this is the floor, not a ceiling.
    // The paired guard in the global setup fails the run if a fixture row reaches the real DB
    // anyway. See `vitest.global-setup.ts`.
    env: { POF_DB_PATH: testDbPath() },
  },
});
