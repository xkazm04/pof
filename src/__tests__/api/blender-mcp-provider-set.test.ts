/**
 * The generation provider set has one definition: GENERATION_PROVIDERS in
 * `lib/blender-mcp/types.ts`. The guard and the refusal sentence derive from it, so a new
 * provider is enabled by one edit and the 400 copy never omits it.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { GENERATION_PROVIDERS, type GenerationProvider } from '@/lib/blender-mcp/types';
import { isGenerationProvider, PROVIDER_REFUSAL_ERROR } from '@/app/api/blender-mcp/_lib/provider';

const ROOT = path.resolve(__dirname, '../..');
const read = (rel: string) => readFileSync(path.join(ROOT, rel), 'utf-8');

describe('blender-mcp generation provider set', () => {
  it('the guard accepts exactly the listed providers', () => {
    for (const p of GENERATION_PROVIDERS) expect(isGenerationProvider(p)).toBe(true);
    expect(isGenerationProvider('tripo')).toBe(false);
    expect(isGenerationProvider(undefined)).toBe(false);
  });

  it('the type is derived from the list (compile-time)', () => {
    const roundTrip: GenerationProvider = GENERATION_PROVIDERS[0];
    expect(typeof roundTrip).toBe('string');
  });

  it('the refusal sentence names every listed provider', () => {
    for (const p of GENERATION_PROVIDERS) expect(PROVIDER_REFUSAL_ERROR).toContain(p);
    expect(PROVIDER_REFUSAL_ERROR).toBe('provider must be hyper3d or hunyuan3d');
  });

  it('no route hand-copies the sentence or a provider literal array', () => {
    for (const rel of [
      'app/api/blender-mcp/generate/route.ts',
      'app/api/blender-mcp/generate/import/route.ts',
      'app/api/blender-mcp/generate/status/route.ts',
      'app/api/blender-mcp/_lib/provider.ts',
    ]) {
      const src = read(rel);
      expect(src, rel).not.toMatch(/provider must be hyper3d/);
      expect(src, rel).not.toMatch(/\[\s*'hyper3d'\s*,\s*'hunyuan3d'\s*\]/);
    }
  });
});
