import { describe, it, expect } from 'vitest';
import { UE_GOTCHAS, formatGotchas } from '@/lib/knowledge/ue-gotchas';
import type { PromptKind } from '@/lib/knowledge/types';

const VALID_KINDS: PromptKind[] = ['ue-cpp', 'ue-python', 'packaging', 'web'];

describe('UE_GOTCHAS data integrity', () => {
  it('has at least the seven seeded gotchas', () => {
    expect(UE_GOTCHAS.length).toBeGreaterThanOrEqual(7);
  });

  it('every gotcha has non-empty fields and a valid appliesTo', () => {
    for (const g of UE_GOTCHAS) {
      expect(g.id, 'id').toBeTruthy();
      expect(g.summary, `summary for ${g.id}`).toBeTruthy();
      expect(g.detail, `detail for ${g.id}`).toBeTruthy();
      expect(g.source, `source for ${g.id}`).toBeTruthy();
      expect(g.appliesTo.length, `appliesTo for ${g.id}`).toBeGreaterThan(0);
      for (const k of g.appliesTo) expect(VALID_KINDS).toContain(k);
    }
  });

  it('has unique ids', () => {
    const ids = UE_GOTCHAS.map((g) => g.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('formatGotchas', () => {
  it('renders a Known UE Pitfalls block for ue-cpp including the cpp gotchas', () => {
    const out = formatGotchas('ue-cpp');
    expect(out).toContain('## Known UE Pitfalls');
    expect(out).toContain('RebuildWidget');
    expect(out).toContain('WITH_EDITOR');
  });

  it('includes the debug-text overlay pitfall for ue-cpp', () => {
    const out = formatGotchas('ue-cpp');
    expect(out).toContain('AddOnScreenDebugMessage');
    expect(out).toMatch(/DisableAllScreenMessages/);
  });

  it('carries GAS attribute/effect pitfalls for ue-cpp', () => {
    const out = formatGotchas('ue-cpp');
    expect(out).toMatch(/meta attribute|PostGameplayEffectExecute/i);
    expect(out).toMatch(/REPNOTIFY|GameplayEffect/);
  });

  it('excludes python-only gotchas from the ue-cpp block', () => {
    expect(formatGotchas('ue-cpp')).not.toContain('Constant3Vector');
  });

  it('includes python gotchas for ue-python', () => {
    expect(formatGotchas('ue-python')).toContain('Constant3Vector');
  });

  it('tells ue-python sessions to introspect the API before guessing names', () => {
    const out = formatGotchas('ue-python');
    expect(out).toMatch(/introspect|lookup_class|dir\(unreal/i);
  });

  it('keeps the introspect-first guidance out of the ue-cpp block', () => {
    expect(formatGotchas('ue-cpp')).not.toMatch(/dir\(unreal/);
  });

  it('carries Lumen lighting best-practice pitfalls for ue-python', () => {
    const out = formatGotchas('ue-python');
    expect(out).toMatch(/Lumen/);
    expect(out).toMatch(/distance field|surface cache|hit lighting/i);
  });

  it('carries modular-character accessory/optimization guidance for ue-python', () => {
    const out = formatGotchas('ue-python');
    expect(out).toMatch(/accessor|modular/i);
    expect(out).toMatch(/occlud|covered|single bone|one bone/i);
  });

  it('tells ue-python sessions to segment a fused AI mesh into named parts before rigging', () => {
    const out = formatGotchas('ue-python');
    expect(out).toMatch(/segment/i);
    expect(out).toMatch(/named part|into.*parts|riggable/i);
    expect(out).toMatch(/Tripo|Rodin|CubePart/);
  });

  it('carries MetaHuman conform INPUT-PREP guidance for ue-python', () => {
    const out = formatGotchas('ue-python');
    expect(out).toMatch(/MetaHuman/);
    expect(out).toMatch(/conform/i);
    expect(out).toMatch(/A-pose|separate.*finger|armpit/i);
    expect(out).toMatch(/remove.*(hair|lashes)|hair.*remov/i);
  });

  it('carries MetaHuman conform TEXTURE/RIG-EXPORT pitfalls for ue-python', () => {
    const out = formatGotchas('ue-python');
    expect(out).toMatch(/DNA/);
    expect(out).toMatch(/UDIM/i);
    expect(out).toMatch(/leaf bone/i);
    expect(out).toMatch(/green channel/i);
  });

  it('keeps MetaHuman conform UDIM/leaf-bone guidance out of the ue-cpp block', () => {
    expect(formatGotchas('ue-cpp')).not.toMatch(/UDIM/);
  });

  it('carries MetaHuman Animator headless memory/windowing guidance for ue-python', () => {
    const out = formatGotchas('ue-python');
    expect(out).toMatch(/MetaHuman (Animator|Performance)/);
    expect(out).toMatch(/set_processing_range/);
    expect(out).toMatch(/memory|RAM/i);
  });

  it('carries MetaHuman Animator multi-window root-drift stitch guidance for ue-python', () => {
    const out = formatGotchas('ue-python');
    expect(out).toMatch(/start_pipeline|MetaHumanPerformance/);
    expect(out).toMatch(/root|pelvis/i);
    expect(out).toMatch(/stitch|re-?anchor|offset|independent/i);
  });

  it('carries AI motion-generator (text→motion) UE-ingestion guidance for ue-python', () => {
    const out = formatGotchas('ue-python');
    expect(out).toMatch(/ARDY|motion generat/i);
    expect(out).toMatch(/\.npz|joint data/i);
    expect(out).toMatch(/IK Retargeter/);
    expect(out).toMatch(/Blender/);
    expect(out).toMatch(/bind.?pose|axis/i);
  });

  it('keeps the motion-generator ingestion guidance out of the ue-cpp block', () => {
    expect(formatGotchas('ue-cpp')).not.toMatch(/\.npz/);
  });

  it('warns that the automated FBX reimport path silently skips AnimSequence creation', () => {
    const out = formatGotchas('ue-python');
    expect(out).toMatch(/reimport/i);
    expect(out).toMatch(/AnimSequence/);
    expect(out).toMatch(/fresh (destination )?folder|rm -rf|filesystem/i);
    expect(out).toMatch(/replace_existing|task\.save/);
  });

  it('carries Niagara optimization pitfalls', () => {
    const out = formatGotchas('ue-python');
    expect(out).toMatch(/Niagara/);
    expect(out).toMatch(/Effect Type|significance/i);
    expect(out).toMatch(/stat named events|Insights/i);
  });

  it('carries Motion Matching pitfalls (root motion need + Phase crash)', () => {
    const out = formatGotchas('ue-cpp');
    expect(out).toMatch(/Motion Matching/i);
    expect(out).toMatch(/Phase channel|root motion/i);
  });

  it('tells GAS sessions to author abilities incrementally, not one-shot the whole system', () => {
    const out = formatGotchas('ue-cpp');
    expect(out).toMatch(/increment|one at a time|one coupled piece|small.*step/i);
    expect(out).toMatch(/one.?shot|whole.*(system|ability)|entire ability/i);
    expect(out).toMatch(/tag|Input Action|GameplayEffect/);
  });

  it('returns an empty string for web', () => {
    expect(formatGotchas('web')).toBe('');
  });

  it('snapshot of the ue-cpp block', () => {
    expect(formatGotchas('ue-cpp')).toMatchSnapshot();
  });
});

describe('formatGotchas module scoping', () => {
  it('no module → the full superset for the kind (unchanged behavior)', () => {
    const superset = formatGotchas('ue-cpp');
    expect(superset).toMatch(/GameplayEffect/);
    expect(superset).toMatch(/Niagara/);
    expect(superset).toMatch(/Motion Matching/);
  });

  it('a materials cpp task SHRINKS — no GAS / Niagara / Motion Matching', () => {
    const out = formatGotchas('ue-cpp', 'materials');
    expect(out).not.toMatch(/GameplayEffect/);
    expect(out).not.toMatch(/Niagara/);
    expect(out).not.toMatch(/Motion Matching/);
    // universal gotchas still ride along
    expect(out).toMatch(/WITH_EDITOR/);
  });

  it('a GAS cpp task retains full GAS coverage', () => {
    const out = formatGotchas('ue-cpp', 'arpg-gas');
    expect(out).toMatch(/meta attribute|PostGameplayEffectExecute/i);
    expect(out).toMatch(/REPNOTIFY/);
    expect(out).toMatch(/one coupled piece|one at a time/i);
    // but not the unrelated animation/vfx pitfalls
    expect(out).not.toMatch(/Motion Matching/);
    expect(out).not.toMatch(/Niagara/);
  });

  it('an UNKNOWN module falls back to the conservative superset (never silently none)', () => {
    const unknown = formatGotchas('ue-cpp', 'totally-made-up-module');
    expect(unknown).toBe(formatGotchas('ue-cpp'));
  });

  it('a python animation task carries the Interchange FBX + motion-matching pitfalls but not materials-only ones', () => {
    const out = formatGotchas('ue-python', 'arpg-animation');
    expect(out).toMatch(/Interchange FBX/);
    expect(out).toMatch(/Motion Matching/);
    expect(out).not.toMatch(/Constant3Vector/); // materials-only
  });
});
