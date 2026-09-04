/**
 * The Code Gen panel must not show code the generator does not emit.
 *
 * Standard: ai-registry `game-production/visual-script-to-code-transpilation`,
 * technique "the fidelity ladder". The local preview is a PARSED-rung artifact:
 * it renders the design, nothing on disk. The real files come from the
 * `generate-gas-effects` task's CodegenReport, which reaches the
 * declared-and-defined rung (and `buildOk` the compiles rung). Each surface
 * states its own rung.
 */
import fs from 'fs';
import path from 'path';
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import {
  generateEffectsCode,
  generatedEffectClassName,
  GENERATED_EFFECT_CLASS_PATTERN,
  GENERATED_EFFECTS_DIR,
} from '@/components/modules/core-engine/sub_ability/blueprint/codegen';
import { GeneratedFilesPanel } from '@/components/modules/core-engine/sub_ability/blueprint/GeneratedFilesPanel';
import type { EditorEffect } from '@/lib/gas-codegen';
import type { CodegenReport } from '@/lib/ability/spec';

afterEach(cleanup);

const burn: EditorEffect = {
  id: 'e1',
  name: 'Burn',
  duration: 'duration',
  durationSec: 4,
  cooldownSec: 0,
  modifiers: [{ attribute: 'Health', operation: 'add', magnitude: -30 }],
  grantedTags: ['State.Burning'],
} as EditorEffect;

describe('GAS code preview names what the generator actually writes', () => {
  it('emits the UGE_Gen_<Ability>_<Effect> class name, not U<Effect>', () => {
    const code = generateEffectsCode([burn], 'Fireball');
    expect(code).toContain('UGE_Gen_Fireball_Burn::UGE_Gen_Fireball_Burn()');
    expect(code).not.toContain('UBurn::UBurn()');
  });

  it('sanitises the ability and effect names into C++ identifiers', () => {
    expect(generatedEffectClassName('Fire Ball!', 'Burn-Over Time')).toBe('UGE_Gen_FireBall_BurnOverTime');
  });

  it('wires modifiers as real FGameplayModifierInfo, not as comments', () => {
    const code = generateEffectsCode([burn], 'Fireball');
    expect(code).toContain('FGameplayModifierInfo');
    expect(code).toContain('UARPGAttributeSet::GetHealthAttribute()');
    expect(code).toContain('Modifiers.Add');
    // The old preview rendered every modifier as `//   Health: -30`.
    expect(code).not.toMatch(/^\/\/\s{3}Health:/m);
  });

  it('keeps the naming rule in lockstep with the generator contract prompt', () => {
    // The prompt is the generator's contract and is READ-ONLY here: this test
    // is the drift alarm between the two, so the preview can never quietly
    // diverge from what the agent is told to write.
    const prompt = fs.readFileSync(
      path.join(process.cwd(), 'src/lib/ability/effect-codegen-prompt.ts'),
      'utf8',
    );
    expect(prompt).toContain(GENERATED_EFFECT_CLASS_PATTERN);
    expect(prompt).toContain(GENERATED_EFFECTS_DIR);
  });

  it('labels the preview as a preview, never as a file on disk', () => {
    const code = generateEffectsCode([burn], 'Fireball');
    expect(code.toLowerCase()).toContain('preview');
    expect(code).toContain(GENERATED_EFFECTS_DIR);
  });
});

describe('GeneratedFilesPanel — the files that actually exist', () => {
  const report: CodegenReport = {
    status: 'confirmed',
    filesWritten: [
      'Source/PoF/AbilitySystem/Effects/Generated/GE_Gen_Fireball_Burn.h',
      'Source/PoF/AbilitySystem/Effects/Generated/GE_Gen_Fireball_Burn.cpp',
    ],
    buildOk: true,
    seedRan: true,
    dataTableRows: 3,
    missingTags: [],
    reportedAt: '2026-09-04T00:00:00.000Z',
  };

  it('lists the real filesWritten and the build verdict when a report exists', () => {
    const { container } = render(<GeneratedFilesPanel report={report} />);
    const text = container.textContent ?? '';
    expect(text).toContain('GE_Gen_Fireball_Burn.cpp');
    expect(text).toMatch(/compiles/i);
    expect(text).toContain('2 files');
  });

  it('says the module did NOT build when buildOk is false', () => {
    const { container } = render(<GeneratedFilesPanel report={{ ...report, buildOk: false }} />);
    const text = container.textContent ?? '';
    expect(text).toMatch(/did not build|build failed/i);
    expect(text).not.toMatch(/\bcompiles\b/i);
  });

  it('says nothing has been generated when there is no report — never implying the preview is on disk', () => {
    const { container } = render(<GeneratedFilesPanel report={null} />);
    const text = container.textContent ?? '';
    expect(text).toMatch(/nothing has been generated/i);
    expect(text).not.toMatch(/\bwritten\b/i);
  });
});
