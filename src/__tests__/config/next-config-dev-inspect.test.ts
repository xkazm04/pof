// @vitest-environment node
/**
 * next.config.ts pins the workspace root to its own directory (`__dirname`) because
 * cwd-based inference picks the wrong root in this multi-project tree. The opt-in
 * DevInspector branch (DEV_INSPECT=1) must follow the same rule: its loader path and
 * the `rootDir` it stamps source locations against are the config's directory, never
 * whatever directory `next dev` happened to be launched from.
 */
import path from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const CONFIG = path.join(REPO_ROOT, 'next.config.ts');

type LoaderRule = { loaders: { loader: string; options: { rootDir: string } }[] };

async function loadConfigFrom(cwd: string) {
  vi.resetModules();
  vi.stubEnv('DEV_INSPECT', '1');
  vi.spyOn(process, 'cwd').mockReturnValue(cwd);
  const mod = await import(/* @vite-ignore */ CONFIG);
  return mod.default as { turbopack?: { root?: string; rules?: Record<string, LoaderRule> } };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe('next.config.ts DEV_INSPECT loader', () => {
  it('resolves the loader and rootDir from the config directory, not process.cwd()', async () => {
    const foreign = path.join(path.parse(REPO_ROOT).root, 'somewhere-else');
    const cfg = await loadConfigFrom(foreign);
    const expectedLoader = path.join(REPO_ROOT, 'scripts', 'dev-inspector', 'source-loc-loader.cjs');

    for (const glob of ['*.tsx', '*.jsx']) {
      const rule = cfg.turbopack?.rules?.[glob];
      expect(rule, glob).toBeDefined();
      const [{ loader, options }] = rule!.loaders;
      expect(path.resolve(loader)).toBe(path.resolve(expectedLoader));
      expect(path.resolve(options.rootDir)).toBe(path.resolve(REPO_ROOT));
    }
  });

  it('keeps the pinned workspace root alongside the loader rules', async () => {
    const cfg = await loadConfigFrom(path.join(path.parse(REPO_ROOT).root, 'somewhere-else'));
    expect(path.resolve(cfg.turbopack?.root ?? '')).toBe(path.resolve(REPO_ROOT));
  });
});
