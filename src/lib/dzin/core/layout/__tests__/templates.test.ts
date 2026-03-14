import { describe, it, expect } from 'vitest';
import { LAYOUT_TEMPLATES, LAYOUT_ORDER, getTemplate } from '../templates';
import type { LayoutTemplateId } from '../types';

describe('LAYOUT_TEMPLATES', () => {
  it('has exactly 8 templates', () => {
    expect(LAYOUT_TEMPLATES).toHaveLength(8);
  });

  it('each template has non-empty gridTemplateRows and gridTemplateColumns', () => {
    for (const t of LAYOUT_TEMPLATES) {
      expect(t.gridTemplateRows.length).toBeGreaterThan(0);
      expect(t.gridTemplateColumns.length).toBeGreaterThan(0);
    }
  });

  it('each template has a non-empty label', () => {
    for (const t of LAYOUT_TEMPLATES) {
      expect(t.label.length).toBeGreaterThan(0);
    }
  });

  const expectedSlotCounts: Record<LayoutTemplateId, number> = {
    stack: 4,
    single: 1,
    'split-2': 2,
    'split-3': 3,
    'grid-4': 4,
    'primary-sidebar': 2,
    triptych: 3,
    studio: 5,
  };

  for (const [id, count] of Object.entries(expectedSlotCounts)) {
    it(`template "${id}" has ${count} slots`, () => {
      const t = LAYOUT_TEMPLATES.find((t) => t.id === id);
      expect(t).toBeDefined();
      expect(t!.slots).toHaveLength(count);
    });
  }

  it('every slot has at least one accepted size', () => {
    for (const t of LAYOUT_TEMPLATES) {
      for (const s of t.slots) {
        expect(s.acceptsSizes.length).toBeGreaterThan(0);
      }
    }
  });

  it('every slot has a preferredRole', () => {
    for (const t of LAYOUT_TEMPLATES) {
      for (const s of t.slots) {
        expect(['primary', 'secondary', 'tertiary', 'sidebar']).toContain(s.preferredRole);
      }
    }
  });

  it('narrow slots only accept compact size', () => {
    for (const t of LAYOUT_TEMPLATES) {
      for (const s of t.slots) {
        if (s.isNarrow) {
          expect(s.acceptsSizes).toContain('compact');
        }
      }
    }
  });
});

describe('LAYOUT_ORDER', () => {
  it('contains all 8 template IDs', () => {
    expect(LAYOUT_ORDER).toHaveLength(8);
    const ids = new Set(LAYOUT_TEMPLATES.map((t) => t.id));
    for (const id of LAYOUT_ORDER) {
      expect(ids.has(id)).toBe(true);
    }
  });

  it('starts with stack and ends with studio', () => {
    expect(LAYOUT_ORDER[0]).toBe('stack');
    expect(LAYOUT_ORDER[LAYOUT_ORDER.length - 1]).toBe('studio');
  });
});

describe('getTemplate', () => {
  it('returns a template by id', () => {
    const t = getTemplate('split-2');
    expect(t).toBeDefined();
    expect(t!.id).toBe('split-2');
  });

  it('returns undefined for unknown id', () => {
    const t = getTemplate('nonexistent' as LayoutTemplateId);
    expect(t).toBeUndefined();
  });
});
