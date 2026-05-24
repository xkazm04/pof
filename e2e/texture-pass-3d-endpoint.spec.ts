import { test, expect } from '@playwright/test';

/**
 * Texture pass — 3D-texture endpoint fallback (folder-06 tests.md e2e #2).
 *
 * Leonardo's 3D PBR texture-GENERATION endpoint is confirmed DEAD (verified live
 * 2026-05-23: `POST /generations-texture` → 404; the official SDK no longer
 * exposes `createTextureGeneration`). See the `leonardo-api-capabilities` memory
 * and the unit coverage in leonardo-client.test.ts (which asserts the lib throws
 * a clear error at the 404 create step).
 *
 * Because the endpoint is gone, this spec does NOT attempt a live 3D texture
 * generation (it would also upload an OBJ to Leonardo and spend credits). Instead
 * it codifies the *fallback contract* at the API boundary:
 *   1. the `texture3d` mode is still routable but strictly input-guarded — a
 *      malformed request returns a controlled error envelope, never a crash and
 *      never a silent external call;
 *   2. Scenario.gg is the wired substitute for true PBR-set generation.
 *
 * Request-level spec (uses the `request` fixture) — CI-safe, no UI, no external
 * call (the 400/500 returns before generateTextureOn3DModel ever runs).
 */
test('texture3d mode is input-guarded — malformed request returns a controlled error, not a crash', async ({ request }) => {
  // Missing objBase64: with a key configured the route returns 400 (Missing
  // objBase64) BEFORE any Leonardo call; without a key it returns 500
  // (not configured). Either way it is a clean { success:false } envelope.
  const res = await request.post('/api/leonardo', { data: { mode: 'texture3d', prompt: 'dark dungeon stone' } });
  expect([400, 500]).toContain(res.status());
  const json = await res.json();
  expect(json.success).toBe(false);
  expect(typeof json.error).toBe('string');
});

test('the Scenario PBR endpoint is the wired substitute (responds with the standard envelope)', async ({ request }) => {
  // POST /api/scenario with no key returns the not-configured envelope (no
  // external call) — proving the substitute path exists and degrades cleanly.
  const res = await request.post('/api/scenario', { data: { prompt: 'seamless dungeon stone PBR' } });
  const json = await res.json();
  expect(json).toHaveProperty('success');
  if (!json.success) {
    expect(typeof json.error).toBe('string');
  } else {
    // A key is configured and it produced a set — convenience URLs are present.
    expect(json.data).toBeTruthy();
  }
});
