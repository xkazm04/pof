import { describe, it, expect } from 'vitest';
import {
  REFERENCE_ROLES,
  ROLE_IDS,
  GEN_PROMPTING_PRACTICES,
  getReferenceRole,
  assembleReferenceDirective,
} from '@/lib/visual-gen/reference-roles';

describe('REFERENCE_ROLES', () => {
  it('covers the core roles incl. blocking + identity, each with prompt phrasing', () => {
    expect(ROLE_IDS).toEqual(expect.arrayContaining(['blocking', 'identity']));
    for (const r of REFERENCE_ROLES) {
      expect(r.id, 'id').toBeTruthy();
      expect(r.label, `label for ${r.id}`).toBeTruthy();
      expect(r.description, `description for ${r.id}`).toBeTruthy();
      expect(r.promptCue, `promptCue for ${r.id}`).toBeTruthy();
    }
  });

  it('has unique ids and getReferenceRole resolves them', () => {
    expect(new Set(ROLE_IDS).size).toBe(ROLE_IDS.length);
    expect(getReferenceRole('blocking')?.id).toBe('blocking');
    expect(getReferenceRole('nope')).toBeUndefined();
  });
});

describe('GEN_PROMPTING_PRACTICES', () => {
  it('encodes the block-first + multi-view-master best practices', () => {
    const text = GEN_PROMPTING_PRACTICES.map((p) => `${p.summary} ${p.detail}`).join(' ');
    expect(text).toMatch(/block/i);
    expect(text).toMatch(/multi.?view|all sides/i);
  });

  it('encodes image→3D input prep: isolate the subject on a plain background', () => {
    const text = GEN_PROMPTING_PRACTICES.map((p) => `${p.summary} ${p.detail}`).join(' ');
    expect(text).toMatch(/plain|white|neutral|isolat/i);
    expect(text).toMatch(/background/i);
    expect(text).toMatch(/image.?to.?3d|mesh|3d/i);
  });

  it('encodes image→3D input prep: a simple canonical pose over a complex one', () => {
    const text = GEN_PROMPTING_PRACTICES.map((p) => `${p.summary} ${p.detail}`).join(' ');
    expect(text).toMatch(/simple|canonical|A-?pose|neutral pose|straightforward pose/i);
    expect(text).toMatch(/pose/i);
    expect(text).toMatch(/artifact|occlu|floater|fused|clean/i);
  });

  it('encodes texturing prep: split the AI color map from the layered PBR material set', () => {
    const text = GEN_PROMPTING_PRACTICES.map((p) => `${p.summary} ${p.detail}`).join(' ');
    expect(text).toMatch(/color (map|texture|base)|albedo/i);
    expect(text).toMatch(/PBR|roughness|material propert/i);
    expect(text).toMatch(/model as (an )?input|3D model as/i);
  });

  it('encodes eye replacement: swap AI-generated eyes for UV’d sphere primitives', () => {
    const text = GEN_PROMPTING_PRACTICES.map((p) => `${p.summary} ${p.detail}`).join(' ');
    expect(text).toMatch(/eye/i);
    expect(text).toMatch(/sphere/i);
    expect(text).toMatch(/unwrap|UV/);
  });

  it('encodes mirroring: author one symmetric half and mirror it', () => {
    const text = GEN_PROMPTING_PRACTICES.map((p) => `${p.summary} ${p.detail}`).join(' ');
    expect(text).toMatch(/mirror/i);
    expect(text).toMatch(/symmetric/i);
    expect(text).toMatch(/textur|unwrap|UV|once/i);
  });

  it('encodes texturing as projection + inpaint repair, not a one-shot', () => {
    const text = GEN_PROMPTING_PRACTICES.map((p) => `${p.summary} ${p.detail}`).join(' ');
    expect(text).toMatch(/project/i);
    expect(text).toMatch(/inpaint/i);
    expect(text).toMatch(/seam|artifact/i);
  });

  it('encodes part-segmentation prep: grid-combined multi-view input + review the part list', () => {
    const text = GEN_PROMPTING_PRACTICES.map((p) => `${p.summary} ${p.detail}`).join(' ');
    expect(text).toMatch(/grid|combined.{0,20}multi.?view|single image.{0,30}views/i);
    expect(text).toMatch(/segment|part/i);
    expect(text).toMatch(/review|assembly logic|swap.?slot|modular/i);
  });

  it('encodes breaking up flat AI materials with a noise mask on roughness + metallic', () => {
    const text = GEN_PROMPTING_PRACTICES.map((p) => `${p.summary} ${p.detail}`).join(' ');
    expect(text).toMatch(/noise/i);
    expect(text).toMatch(/roughness/i);
    expect(text).toMatch(/metallic|metalness/i);
    expect(text).toMatch(/flat|uniform|even/i);
  });

  it('encodes authoring glow as its own emission mask rather than baking it into the colour map', () => {
    const text = GEN_PROMPTING_PRACTICES.map((p) => `${p.summary} ${p.detail}`).join(' ');
    expect(text).toMatch(/emissi/i);
    expect(text).toMatch(/mask/i);
    expect(text).toMatch(/albedo|colou?r map|base.?colou?r/i);
  });
});

describe('assembleReferenceDirective', () => {
  it('builds an ordered, role-tagged directive that names each reference', () => {
    const out = assembleReferenceDirective(
      [
        { role: 'blocking', label: 'playblast.mp4' },
        { role: 'identity', label: 'watch_master.png' },
      ],
      'render a photoreal watch promo shot',
    );
    expect(out).toMatch(/playblast\.mp4/);
    expect(out).toMatch(/watch_master\.png/);
    expect(out).toMatch(/motion|blocking/i);
    expect(out).toMatch(/render a photoreal watch promo shot/);
  });

  it('ignores unknown roles gracefully', () => {
    const out = assembleReferenceDirective([{ role: 'bogus', label: 'x.png' }], 'task');
    expect(out).toMatch(/task/);
  });
});
