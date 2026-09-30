/**
 * The C++ codegen prompt consumes the ProcgenSpec, and only the fields the
 * engine matrix says `llm-codegen` reads.
 *
 * Before: the prompt took a parallel `ProceduralLevelConfig` with the RAW seed
 * text. A blank seed told the CLI "Random (FMath::Rand())" while the preview
 * the designer judged ran on 1337, a label like "abc" was sent as an int32
 * literal, and `ensureConnected` was kept out of the prompt only by a strip at
 * the wizard's call site. `PROCGEN_ENGINES['llm-codegen'].reads` was a claim no
 * test checked against the prompt text.
 */
import { describe, it, expect } from 'vitest';
import { buildProceduralLevelPrompt } from '@/lib/prompts/level-design';
import {
  buildProcgenSpec, PROCGEN_ENGINES, specFieldsIgnoredBy,
  type ProcgenSpec, type ProcgenSpecField,
} from '@/lib/level-design/procgen-spec';
import { hashSeed, DEFAULT_PREVIEW_SEED } from '@/lib/level-design/frandom-stream';

const CTX = { projectName: 'Did', projectPath: 'C:/Unreal Projects/Did', ueVersion: '5.5' };

const BASE: ProcgenSpec = buildProcgenSpec({
  algorithm: 'bsp',
  levelType: 'dungeon',
  gridWidth: 64,
  gridHeight: 64,
  roomCountMin: 8,
  roomCountMax: 15,
  corridorWidth: 3,
  seed: '',
  constraints: {
    spawnPoints: true, lootPlacement: true, bossRoom: true, secretRooms: false, safeZones: false,
    ensureConnected: false,
  },
});

/** One single-field change per spec field. A Record, so a new field forces a mutator here. */
const MUTATE: Record<ProcgenSpecField, (s: ProcgenSpec) => ProcgenSpec> = {
  algorithm: (s) => ({ ...s, algorithm: 'wfc' }),
  levelType: (s) => ({ ...s, levelType: 'arena' }),
  gridSize: (s) => ({ ...s, gridWidth: s.gridWidth + 16 }),
  roomBand: (s) => ({ ...s, roomCountMax: s.roomCountMax + 5 }),
  corridorWidth: (s) => ({ ...s, corridorWidth: s.corridorWidth + 1 }),
  seed: (s) => ({ ...s, seedLabel: 'dark-keep', seedValue: hashSeed('dark-keep') }),
  constraints: (s) => ({ ...s, constraints: { ...s.constraints, secretRooms: !s.constraints.secretRooms } }),
  ensureConnected: (s) => ({ ...s, constraints: { ...s.constraints, ensureConnected: !s.constraints.ensureConnected } }),
};

describe('buildProceduralLevelPrompt sends the seed the preview used', () => {
  it('a blank seed sends DEFAULT_PREVIEW_SEED, never an unseeded random', () => {
    const prompt = buildProceduralLevelPrompt(BASE, CTX);
    expect(DEFAULT_PREVIEW_SEED).toBe(1337);
    expect(prompt).toContain('Seed: **1337**');
    expect(prompt).not.toContain('FMath::Rand');
  });

  it('a label sends its resolved int32, never the label as the Seed value', () => {
    const spec = buildProcgenSpec({ ...BASE, seed: 'abc' });
    const prompt = buildProceduralLevelPrompt(spec, CTX);
    expect(prompt).toContain(`**${hashSeed('abc')}**`);
    expect(prompt).not.toMatch(/Seed: \*\*abc\*\*/);
    expect(prompt).not.toContain('**abc**');
  });
});

describe("PROCGEN_ENGINES['llm-codegen'].reads is enforced against the prompt", () => {
  const specs: ProcgenSpec[] = [
    BASE,
    { ...BASE, algorithm: 'cellular', constraints: { ...BASE.constraints, ensureConnected: true } },
    buildProcgenSpec({ ...BASE, algorithm: 'perlin', levelType: 'openworld', seed: 'ash-vault' }),
  ];

  it.each(specs.map((s) => [`${s.algorithm}/${s.levelType}`, s] as const))(
    '%s: every read field moves the prompt, every ignored field leaves it byte-identical',
    (_label, spec) => {
      const before = buildProceduralLevelPrompt(spec, CTX);
      const reads = PROCGEN_ENGINES['llm-codegen'].reads;
      expect(reads.length).toBeGreaterThan(0);
      for (const field of reads) {
        expect(buildProceduralLevelPrompt(MUTATE[field](spec), CTX), `read field ${field}`).not.toBe(before);
      }
      const ignored = specFieldsIgnoredBy('llm-codegen', spec);
      expect(ignored).toContain('ensureConnected');
      for (const field of ignored) {
        expect(buildProceduralLevelPrompt(MUTATE[field](spec), CTX), `ignored field ${field}`).toBe(before);
      }
    },
  );
});
