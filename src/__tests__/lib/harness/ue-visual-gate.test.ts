import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  inspectFrame,
  executeUeVisualGate,
  createUeVisualGate,
  resolveVlmFromEnv,
  type FrameCapture,
} from '@/lib/harness/ue-visual-gate';
import { detectGates } from '@/lib/harness/verifier';
import type { UeEnv } from '@/lib/harness/ue-gates';

const ENV: UeEnv = { editorCmd: 'C:/UE/UnrealEditor-Cmd.exe', uproject: 'C:/proj/PoF.uproject' };

let tmp: string;
beforeEach(() => { tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ue-visual-')); });
afterEach(() => { try { fs.rmSync(tmp, { recursive: true, force: true }); } catch { /* */ } });

/** Write a fake "frame" of `bytes` size and return its path. */
function fakeFrame(bytes: number, name = 'frame.png'): string {
  const p = path.join(tmp, name);
  fs.writeFileSync(p, Buffer.alloc(bytes, 0x41)); // non-zero bytes → passes byte floor
  return p;
}

/** A capture seam that always returns `framePath` (or null to simulate failure). */
function captureReturning(framePath: string | null): FrameCapture {
  return async () => framePath;
}

// ── inspectFrame heuristic (documented byte floor; pixel pass if pngjs present) ──

describe('inspectFrame', () => {
  it('flags a tiny file as blank/black via the byte floor', () => {
    const r = inspectFrame(fakeFrame(1024));
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/floor|blank|black/i);
  });

  it('accepts a large frame (byte floor) when pixel inspection is unavailable', () => {
    const r = inspectFrame(fakeFrame(20 * 1024));
    // pngjs is not a dependency → byte-floor verdict stands.
    expect(r.ok).toBe(true);
    expect(r.bytes).toBeGreaterThanOrEqual(20 * 1024);
  });

  it('reports unreadable file honestly', () => {
    const r = inspectFrame(path.join(tmp, 'nope.png'));
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/not readable/i);
  });
});

// ── executeUeVisualGate verdict mapping (faked capture layer) ──────────────────

describe('executeUeVisualGate', () => {
  it('no UE env → unverifiable, never a pass', async () => {
    const r = await executeUeVisualGate('C:/proj', tmp, 1, { env: null, capture: captureReturning(fakeFrame(20 * 1024)) });
    expect(r.unverifiable).toBe(true);
    expect(r.passed).toBe(false);
    expect(r.output).toMatch(/UNVERIFIABLE/i);
  });

  it('env present but no frame produced → unverifiable (environmental, not a code fail)', async () => {
    const r = await executeUeVisualGate('C:/proj', tmp, 2, { env: ENV, capture: captureReturning(null), vlm: false });
    expect(r.unverifiable).toBe(true);
    expect(r.passed).toBe(false);
    expect(r.output).toMatch(/no frame/i);
  });

  it('black / near-empty frame → fail (game booted but rendered nothing)', async () => {
    const r = await executeUeVisualGate('C:/proj', tmp, 3, { env: ENV, capture: captureReturning(fakeFrame(1024)), vlm: false });
    expect(r.passed).toBe(false);
    expect(r.unverifiable).toBeUndefined();
    expect(r.errors?.[0]?.message).toMatch(/BLACK_FRAME/);
  });

  it('non-empty frame with VLM off → pass, and stores a labeled GAME capture', async () => {
    const r = await executeUeVisualGate('C:/proj', tmp, 4, { env: ENV, capture: captureReturning(fakeFrame(20 * 1024)), vlm: false });
    expect(r.passed).toBe(true);
    expect(r.screenshot).toBeTruthy();

    // Frame stored under the run + result.json row tagged capture:'game'.
    const stored = path.join(tmp, 'screenshots', '4', 'game.png');
    expect(fs.existsSync(stored)).toBe(true);
    const result = JSON.parse(fs.readFileSync(path.join(tmp, 'screenshots', '4', 'result.json'), 'utf-8'));
    expect(result.modules[0].capture).toBe('game');
    expect(result.modules[0].slug).toBe('game');
    expect(result.modules[0].status).toBe('pass');
  });

  it('VLM fail overrides the heuristic floor', async () => {
    const fetchImpl = (async () => new Response(
      JSON.stringify({ success: true, data: { verdict: 'fail', notes: 'scene is black' } }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )) as unknown as typeof fetch;
    const r = await executeUeVisualGate('C:/proj', tmp, 5, {
      env: ENV,
      capture: captureReturning(fakeFrame(20 * 1024)),
      vlm: { appOrigin: 'http://localhost:3000' },
      fetchImpl,
    });
    expect(r.passed).toBe(false);
    expect(r.errors?.some((e) => /VLM_FAIL/.test(e.message))).toBe(true);
  });

  it('VLM outage keeps the frame + passes on the heuristic (no false regression)', async () => {
    const fetchImpl = (async () => new Response(
      JSON.stringify({ success: false, error: 'no key' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } },
    )) as unknown as typeof fetch;
    const r = await executeUeVisualGate('C:/proj', tmp, 6, {
      env: ENV,
      capture: captureReturning(fakeFrame(20 * 1024)),
      vlm: { appOrigin: 'http://localhost:3000' },
      fetchImpl,
    });
    expect(r.passed).toBe(true);
    expect(r.output).toMatch(/unavailable/i);
  });

  it('VLM pass keeps the pass', async () => {
    const fetchImpl = (async () => new Response(
      JSON.stringify({ success: true, data: { verdict: 'pass', notes: 'lit' } }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )) as unknown as typeof fetch;
    const r = await executeUeVisualGate('C:/proj', tmp, 7, {
      env: ENV,
      capture: captureReturning(fakeFrame(20 * 1024)),
      vlm: { appOrigin: 'http://localhost:3000' },
      fetchImpl,
    });
    expect(r.passed).toBe(true);
  });
});

// ── resolveVlmFromEnv ──────────────────────────────────────────────────────────

describe('resolveVlmFromEnv', () => {
  it('is off unless POF_UE_VISUAL_VLM is set', () => {
    expect(resolveVlmFromEnv({})).toBe(false);
    expect(resolveVlmFromEnv({ POF_UE_VISUAL_VLM: '0' })).toBe(false);
  });
  it('enables with a default origin + mode when flagged', () => {
    const v = resolveVlmFromEnv({ POF_UE_VISUAL_VLM: '1' });
    expect(v).not.toBe(false);
    if (v) { expect(v.appOrigin).toMatch(/localhost/); }
  });
  it('honors POF_APP_ORIGIN + POF_UE_VISUAL_VLM_MODE', () => {
    const v = resolveVlmFromEnv({ POF_UE_VISUAL_VLM: 'true', POF_APP_ORIGIN: 'http://host:9', POF_UE_VISUAL_VLM_MODE: 'character' });
    expect(v).toEqual({ appOrigin: 'http://host:9', mode: 'character' });
  });
});

// ── detectGates opt-in wiring (UE-only, appended without editing ue-gates.ts) ──

describe('detectGates — ue-visual opt-in', () => {
  it('appends the advisory ue-visual gate on a UE tree only when opted in', () => {
    const proj = fs.mkdtempSync(path.join(os.tmpdir(), 'ue-tree-'));
    fs.writeFileSync(path.join(proj, 'PoF.uproject'), '{}');
    try {
      const withGate = detectGates(proj, { env: null, ueVisual: true });
      const bare = detectGates(proj, { env: null });
      expect(withGate.some((g) => g.type === 'ue-visual')).toBe(true);
      expect(bare.some((g) => g.type === 'ue-visual')).toBe(false);
      const gate = withGate.find((g) => g.type === 'ue-visual')!;
      expect(gate.required).toBe(false); // advisory — never blocks the loop
    } finally {
      fs.rmSync(proj, { recursive: true, force: true });
    }
  });

  it('never adds ue-visual to a webapp tree', () => {
    const proj = fs.mkdtempSync(path.join(os.tmpdir(), 'web-tree-'));
    fs.writeFileSync(path.join(proj, 'package.json'), '{}');
    try {
      expect(detectGates(proj, { ueVisual: true }).some((g) => g.type === 'ue-visual')).toBe(false);
    } finally {
      fs.rmSync(proj, { recursive: true, force: true });
    }
  });
});

describe('createUeVisualGate', () => {
  it('is advisory + typed ue-visual', () => {
    const g = createUeVisualGate();
    expect(g).toEqual({ name: 'ue-visual', type: 'ue-visual', required: false });
  });
});
