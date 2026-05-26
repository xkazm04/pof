import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

// next/font is a Next compiler transform; stub it for the vitest environment.
vi.mock('next/font/google', () => {
  const f = () => ({ className: 'font-mock' });
  return { IBM_Plex_Mono: f, Inter: f, JetBrains_Mono: f };
});

import { CatalogTree } from '@/components/layout-lab/CatalogTree';
import { StepFrame } from '@/components/layout-lab/steps/StepFrame';
import { lifecycleStatus } from '@/components/layout-lab/statusLanguage';
import { LIGHT } from '@/components/layout-lab/theme';
import type { LabGroup, LabEntity } from '@/components/layout-lab/useLabCatalogData';

const group = (entities: LabEntity[]): LabGroup => ({
  category: 'Combat',
  catalogs: [{ catalogId: 'items', label: 'Items', description: '', total: entities.length, verified: entities.filter(e => e.lifecycle === 'verified').length }],
});

describe('CatalogTree status encoding (shape + label, not color alone)', () => {
  afterEach(cleanup);

  it('encodes lifecycle as a glyph + aria-label that survives grayscale', () => {
    const entities: LabEntity[] = [
      { id: 'a', name: 'Fireball', lifecycle: 'verified', data: null },
      { id: 'b', name: 'Frostbolt', lifecycle: 'failed', data: null },
      { id: 'c', name: 'Stoneskin', lifecycle: 'scaffolded', data: null },
    ];
    render(
      <CatalogTree
        t={LIGHT}
        groups={[group(entities)]}
        selectedCatalogId="items"
        entities={entities}
        selectedEntityId={null}
        onSelectCatalog={() => {}}
        onSelectEntity={() => {}}
      />,
    );

    // Each entity row carries an accessible name with a plain-language status word.
    const pass = screen.getByRole('button', { name: 'Fireball: passed' });
    const fail = screen.getByRole('button', { name: 'Frostbolt: failed' });
    const pending = screen.getByRole('button', { name: 'Stoneskin: pending' });

    // Pass is conveyed by a filled dot (no glyph needed).
    expect(pass.textContent).toBe('Fireball');
    // Fail/pending carry a redundant glyph so they survive grayscale.
    expect(fail.textContent).toContain('✕');
    expect(pending.textContent).toContain('○');
  });

  it('maps in-progress lifecycle states to a single "pending" status', () => {
    expect(lifecycleStatus('verified')).toBe('pass');
    expect(lifecycleStatus('failed')).toBe('fail');
    expect(lifecycleStatus('planned')).toBe('pending');
    expect(lifecycleStatus('scaffolded')).toBe('pending');
    expect(lifecycleStatus('generated')).toBe('pending');
    expect(lifecycleStatus('wired')).toBe('pending');
  });
});

describe('StepFrame banner status encoding', () => {
  afterEach(cleanup);

  it('renders the status pill as a role=img with glyph + label, not color alone', () => {
    render(
      <StepFrame
        t={LIGHT}
        acceptance={{ label: 'Economy', status: 'fail', detail: 'budget overspent', tier: 'L2' }}
        panels={[{ label: 'View', node: <div>view</div> }]}
      />,
    );

    const pill = screen.getByRole('img', { name: 'Economy: failed, tier L2' });
    // glyph stays visible without color (WCAG 1.4.1)
    expect(pill.textContent).toContain('✕');
    // the original FAIL · L2 label is still rendered for sighted users
    expect(pill.textContent).toContain('FAIL');
    expect(pill.textContent).toContain('L2');
  });

  it('uses the deferred glyph for unrun gates', () => {
    render(
      <StepFrame
        t={LIGHT}
        acceptance={{ label: 'Test Gate', status: 'deferred', detail: 'awaiting runner', tier: 'L3' }}
        panels={[{ label: 'View', node: <div>view</div> }]}
      />,
    );
    const pill = screen.getByRole('img', { name: 'Test Gate: deferred, tier L3' });
    expect(pill.textContent).toContain('⏸');
  });

  it('uses the pass glyph + label for green acceptance', () => {
    render(
      <StepFrame
        t={LIGHT}
        acceptance={{ label: 'Concept Brief', status: 'pass', detail: '', tier: 'L0' }}
        panels={[{ label: 'View', node: <div>view</div> }]}
      />,
    );
    const pill = screen.getByRole('img', { name: 'Concept Brief: passed, tier L0' });
    expect(pill.textContent).toContain('✓');
  });
});
