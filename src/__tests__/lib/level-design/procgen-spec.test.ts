import { describe, it, expect } from 'vitest';
import {
  buildProcgenSpec,
  previewConfigFromSpec,
  ueDungeonParamsFromSpec,
  specFieldsIgnoredBy,
  describeIgnoredFields,
  layoutAgreement,
  browserPreviewResult,
  ueRunResult,
  PROCGEN_ENGINES,
  PROCGEN_SPEC_FIELDS,
  type ProcgenConstraints,
  type ProcgenEngine,
  type ProcgenSpec,
} from '@/lib/level-design/procgen-spec';
import { generatePreview } from '@/lib/level-design/procgen-preview';
import { UE_ROOMS_MIN, UE_ROOMS_MAX } from '@/lib/level-design/run-params';
import { hashSeed } from '@/lib/level-design/frandom-stream';
import type { ProcgenRun } from '@/types/procgen';

const BASE = {
  algorithm: 'bsp',
  levelType: 'dungeon',
  gridWidth: 64,
  gridHeight: 64,
  roomCountMin: 6,
  roomCountMax: 12,
  corridorWidth: 2,
  seed: 'dark-keep',
  constraints: {
    spawnPoints: true, lootPlacement: true, bossRoom: true, secretRooms: false, safeZones: false,
  },
} as const;

const spec = (over: Partial<Parameters<typeof buildProcgenSpec>[0]> = {}): ProcgenSpec =>
  buildProcgenSpec({ ...BASE, ...over });

describe('ProcgenSpec — one shape, with an explicit seed', () => {
  it('resolves the seed once, into the spec', () => {
    const s = spec();
    expect(s.seedLabel).toBe('dark-keep');
    expect(s.seedValue).toBe(hashSeed('dark-keep'));
    expect(Number.isInteger(s.seedValue)).toBe(true);
  });

  it('carries a blank seed as a resolved default rather than an absent one', () => {
    const s = spec({ seed: '' });
    expect(s.seedLabel).toBe('');
    expect(s.seedValue).toBe(hashSeed(''));
  });

  it('copies the constraint toggles as declared inputs, not a shared reference', () => {
    const src: ProcgenConstraints = { ...BASE.constraints };
    const s = buildProcgenSpec({ ...BASE, constraints: src });
    src.bossRoom = false;
    expect(s.constraints.bossRoom).toBe(true);
  });

  it('drives the browser preview — the preview config is DERIVED from the spec', () => {
    const s = spec();
    const cfg = previewConfigFromSpec(s);
    expect(cfg).toEqual({
      algorithm: 'bsp', gridWidth: 64, gridHeight: 64,
      roomCountMin: 6, roomCountMax: 12, corridorWidth: 2, seed: 'dark-keep',
    });
    expect(previewConfigFromSpec(s, 256).maxPreviewSize).toBe(256);
    // And it really generates: a spec is a runnable request, not a label.
    expect(generatePreview(cfg).seedValue).toBe(s.seedValue);
  });
});

describe('the UE handoff is lossy, and says so', () => {
  it('collapses the room band to one target and REPORTS the collapse', () => {
    const p = ueDungeonParamsFromSpec(spec({ roomCountMin: 6, roomCountMax: 12 }));
    expect(p.roomCount).toBe(9);
    expect(p.notes.some((n) => /collapsed to 9/.test(n))).toBe(true);
    expect(p.notes.some((n) => /TargetRoomCount/.test(n))).toBe(true);
  });

  it('stays silent about a collapse that did not happen', () => {
    const p = ueDungeonParamsFromSpec(spec({ roomCountMin: 8, roomCountMax: 8 }));
    expect(p.roomCount).toBe(8);
    expect(p.notes.some((n) => /collapsed/.test(n))).toBe(false);
  });

  it('clamps to the panel bounds and REPORTS the clamp', () => {
    const hi = ueDungeonParamsFromSpec(spec({ roomCountMin: 40, roomCountMax: 60 }));
    expect(hi.roomCount).toBe(UE_ROOMS_MAX);
    expect(hi.notes.some((n) => /clamped to 20/.test(n))).toBe(true);

    const lo = ueDungeonParamsFromSpec(spec({ roomCountMin: 1, roomCountMax: 1 }));
    expect(lo.roomCount).toBe(UE_ROOMS_MIN);
    expect(lo.notes.some((n) => /clamped to 2/.test(n))).toBe(true);
  });

  it('sends a non-negative seed that UE recovers as the identical int32', () => {
    const s = spec({ seed: 'dark-keep' });
    expect(s.seedValue).toBeLessThan(0); // the FNV hash of this label is negative
    const p = ueDungeonParamsFromSpec(s);
    expect(p.seed).toBeGreaterThanOrEqual(0);
    expect(p.seed | 0).toBe(s.seedValue); // lossless, not clamped
    expect(p.notes.some((n) => /unsigned/.test(n))).toBe(true);
  });

  it('leaves a plain numeric seed untouched and unremarked', () => {
    const p = ueDungeonParamsFromSpec(spec({ seed: '1337' }));
    expect(p.seed).toBe(1337);
    expect(p.notes.some((n) => /unsigned/.test(n))).toBe(false);
  });
});

describe('what each engine ignores is stated, never implied', () => {
  it('names every declared input ARPGLevelGenerator drops', () => {
    const dropped = specFieldsIgnoredBy('ue-arpg-generator', spec());
    expect(dropped.sort()).toEqual(
      ['algorithm', 'levelType', 'gridSize', 'corridorWidth', 'constraints'].sort(),
    );
    const lines = describeIgnoredFields('ue-arpg-generator', spec());
    expect(lines.some((l) => l.includes('Algorithm (BSP)'))).toBe(true);
    expect(lines.some((l) => l.includes('Grid size (64x64)'))).toBe(true);
    expect(lines.some((l) => l.includes('Gameplay constraints (3 on)'))).toBe(true);
  });

  it('narrows the browser preview per algorithm, reusing the algo-params source', () => {
    expect(specFieldsIgnoredBy('browser-preview', spec({ algorithm: 'bsp' })).sort())
      .toEqual(['levelType', 'constraints'].sort());
    // Cellular has no room list and no corridors — the preview drops both.
    expect(specFieldsIgnoredBy('browser-preview', spec({ algorithm: 'cellular' })).sort())
      .toEqual(['levelType', 'constraints', 'roomBand', 'corridorWidth'].sort());
  });

  it('every engine declares only fields the spec actually has', () => {
    for (const facts of Object.values(PROCGEN_ENGINES)) {
      for (const f of facts.reads) expect(PROCGEN_SPEC_FIELDS).toContain(f);
    }
  });
});

describe('layoutAgreement — the model may not imply an agreement the code lacks', () => {
  const engines = Object.keys(PROCGEN_ENGINES) as ProcgenEngine[];

  it('NO cross-engine pair ever agrees on a layout', () => {
    const agreeing: string[] = [];
    for (const a of engines) {
      for (const b of engines) {
        if (a === b) continue;
        if (layoutAgreement(a, b).agree) agreeing.push(`${a}->${b}`);
      }
    }
    expect(agreeing).toEqual([]);
  });

  it('gives the structural reason for the preview vs UE pair', () => {
    const r = layoutAgreement('browser-preview', 'ue-arpg-generator');
    expect(r.agree).toBe(false);
    expect(r.reason).toMatch(/room-template actors/);
    expect(r.reason).toMatch(/no algorithm parameter/);
    // Symmetric — the direction of the question cannot change the answer.
    expect(layoutAgreement('ue-arpg-generator', 'browser-preview')).toEqual(r);
  });

  it('a deterministic engine agrees with itself; an unenforced one does not', () => {
    expect(layoutAgreement('browser-preview', 'browser-preview').agree).toBe(true);
    expect(layoutAgreement('llm-codegen', 'llm-codegen').agree).toBe(false);
  });

  it('every reason is non-empty, so a false can never read as unexplained', () => {
    for (const a of engines) {
      for (const b of engines) expect(layoutAgreement(a, b).reason.length).toBeGreaterThan(20);
    }
  });
});

describe('ProcgenResult — one result shape across engines', () => {
  it('carries the preview grid and its declared spec', () => {
    const s = spec();
    const r = browserPreviewResult(s, generatePreview(previewConfigFromSpec(s)));
    expect(r.engine).toBe('browser-preview');
    expect(r.specSource).toBe('declared');
    expect(r.spec).toBe(s);
    expect(r.grid?.length).toBeGreaterThan(0);
    expect(r.success).toBe(true);
    expect(r.failureReason).toBe('');
  });

  it('marks a recorded UE run UNRECORDED rather than inventing the spec it ran from', () => {
    const run: ProcgenRun = {
      id: 1, seed: 1234, algorithm: 'arpg-level-generator', params: {}, docId: null,
      mapPath: '/Game/Maps/ProcGenDungeon', success: true, failureReason: '',
      createdAt: '2026-08-20T00:00:00Z', roomCount: 8,
    };
    const r = ueRunResult(run);
    expect(r.engine).toBe('ue-arpg-generator');
    expect(r.spec).toBeNull();
    expect(r.specSource).toBe('unrecorded');
    expect(r.grid).toBeNull();
    expect(r.roomCount).toBe(8);
  });

  it('keeps a failed UE run a failure, never a 0-room success', () => {
    const run: ProcgenRun = {
      id: 2, seed: 9, algorithm: '', params: {}, docId: null, mapPath: '',
      success: false, failureReason: 'editor exited before baking', createdAt: 'x', roomCount: 0,
    };
    const r = ueRunResult(run);
    expect(r.success).toBe(false);
    expect(r.failureReason).toBe('editor exited before baking');
  });
});
