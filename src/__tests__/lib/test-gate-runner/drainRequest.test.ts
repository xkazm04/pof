import { describe, it, expect } from 'vitest';
import { DRAIN_REQUEST_KEYS, parseDrainRequest } from '@/lib/test-gate-runner/drainRequest';
import { parseDrainFilter } from '@/lib/test-gate-runner/drain';
import { PIPELINE_TOOLS } from '../../../../tools/pof-mcp/src/tools/pipeline';

describe('parseDrainFilter — full scope surface', () => {
  it('parses an entityIds ARRAY (POST body form)', () => {
    const body: Record<string, unknown> = { tier: 'L3', catalogId: 'items', entityIds: ['a', 'b', 'a', ''] };
    expect(parseDrainFilter((k) => body[k])).toEqual({ tier: 'L3', catalogId: 'items', entityIds: ['a', 'b'] });
  });

  it('parses a comma-separated entityIds STRING (GET query form) so a batch can be previewed', () => {
    const sp = new URLSearchParams('tier=L4&catalogId=items&entityIds=a,%20b,a');
    expect(parseDrainFilter((k) => sp.get(k))).toEqual({ tier: 'L4', catalogId: 'items', entityIds: ['a', 'b'] });
  });

  it('an empty/garbage entityIds is simply absent (global/catalog scope preserved)', () => {
    expect(parseDrainFilter(() => undefined)).toEqual({});
    const body: Record<string, unknown> = { entityIds: [] };
    expect(parseDrainFilter((k) => body[k])).toEqual({});
  });

  it('drops a non-runnable tier (only L3/L4 are drainable)', () => {
    const body: Record<string, unknown> = { tier: 'L2' };
    expect(parseDrainFilter((k) => body[k])).toEqual({});
  });
});

describe('parseDrainRequest', () => {
  it('normalizes the whole documented body: scope + run options', () => {
    expect(parseDrainRequest({
      tier: 'L3', catalogId: 'items', entityIds: ['a', 'b'], executor: 'spawn', allowSpawn: true,
      port: 30041, limit: 2, screenshotPath: 'C:/shot.png', visualMode: 'hud',
      projectPath: 'C:/proj', autoCapture: true, bogus: 'ignored',
    })).toEqual({
      filter: { tier: 'L3', catalogId: 'items', entityIds: ['a', 'b'] },
      executor: 'spawn', allowSpawn: true, port: 30041, limit: 2,
      screenshotPath: 'C:/shot.png', visualMode: 'hud', projectPath: 'C:/proj', autoCapture: true,
    });
  });

  it('defaults to the bridge executor and an empty (GLOBAL) filter', () => {
    expect(parseDrainRequest({})).toEqual({ filter: {}, executor: 'bridge' });
    expect(parseDrainRequest(null)).toEqual({ filter: {}, executor: 'bridge' });
  });

  it('rejects an unknown visualMode instead of forwarding it', () => {
    expect(parseDrainRequest({ visualMode: 'nonsense' }).visualMode).toBeUndefined();
  });
});

describe('pof_drain_gates ↔ drain route schema parity', () => {
  const tool = PIPELINE_TOOLS.find((t) => t.name === 'pof_drain_gates')!;
  const schema = tool.inputSchema as { properties: Record<string, { description?: string }>; required?: string[] };

  it('exposes EXACTLY the route\'s accepted keys — no unreachable scope', () => {
    expect(Object.keys(schema.properties).sort()).toEqual([...DRAIN_REQUEST_KEYS].sort());
  });

  it('requires nothing — a global drain (no catalogId/entityId) must be callable', () => {
    expect(schema.required ?? []).toEqual([]);
  });

  it('documents every key (an agent picks scope from the schema alone)', () => {
    const undocumented = Object.entries(schema.properties)
      .filter(([, v]) => !v.description)
      .map(([k]) => k);
    expect(undocumented).toEqual([]);
  });
});
