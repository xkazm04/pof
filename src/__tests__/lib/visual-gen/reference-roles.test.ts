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
