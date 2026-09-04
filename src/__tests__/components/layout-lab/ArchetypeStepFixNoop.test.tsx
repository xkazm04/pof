import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
vi.mock('next/font/google', () => { const f = () => ({ className: 'm' }); return { IBM_Plex_Mono: f, Inter: f, JetBrains_Mono: f }; });
import { ArchetypeStep } from '@/components/layout-lab/steps/ArchetypeStep';
import { useLabPipelineStore } from '@/components/layout-lab/labPipelineStore';
import { LAB_THEMES } from '@/components/layout-lab/theme';
import { stepContentHash } from '@/lib/judge/contentHash';
import { readsDirection } from '@/lib/catalog/stepSpec';
import type { StepSpec } from '@/lib/catalog/stepSpec';
import type { LabEntity } from '@/components/layout-lab/useLabCatalogData';
import type { AcceptanceResult } from '@/lib/catalog/acceptance/types';

/**
 * "⚡ Produce fix" on a STATIC step calls `spec.produce(entity, dir)`. Measured over the
 * 33 registered pipeline files on 2026-09-04: 344 `produce:` literals, **0** declare a
 * second (`direction`) parameter and **0** contain `Math.random`/`Date.now`. So on an
 * already-produced static step the fix re-writes byte-identical data — the verdict cannot
 * move, forever — while the banner previews a carefully derived corrective direction
 * verbatim, as if it were about to be acted on.
 *
 * A button that cannot work must not be offered, and the panel must say what WOULD change
 * the step. Standard: catalog-pipeline-authoring / absence-must-never-read-as-exemption.
 */

const t = LAB_THEMES[0];
const entity: LabEntity = { id: 'noop1', name: 'Bramble', lifecycle: 'planned', data: {} };

/** Direction-blind + deterministic (the shape of every registered produce body today),
 *  whose checker fails on the CONTENT it wrote — the real, previously untested case. */
const blindSpec: StepSpec = {
  archetype: 'brief', label: 'Concept Brief',
  view: { kind: 'prose', field: 'brief', emptyText: 'No brief yet' },
  produce: () => ({ data: { brief: 'too short' } }),
  accept: (data): AcceptanceResult =>
    String(data.brief ?? '').length >= 300
      ? { label: 'Brief ≥ 300', status: 'pass', tier: 'L0', detail: 'ok' }
      : { label: 'Brief ≥ 300', status: 'fail', tier: 'L0', detail: 'short', reason: 'brief is 9 / 300 chars' },
};

/** Same step, but its body READS the direction — a fix here can genuinely move the verdict. */
const awareSpec: StepSpec = {
  ...blindSpec,
  produce: (_e, direction) => ({ data: { brief: (direction ?? '').padEnd(300, '.') } }),
};

const status = () => screen.getByTestId('acceptance-banner').getAttribute('data-status');
const dataNow = () => useLabPipelineStore.getState().byEntity[entity.id]?.['Concept Brief']?.data ?? {};

describe('readsDirection — the produce contract, probed from the body itself', () => {
  it('is false for a body that declares no direction parameter', () => {
    expect(readsDirection(blindSpec)).toBe(false);
  });

  it('is true for a body that declares one', () => {
    expect(readsDirection(awareSpec)).toBe(true);
  });

  it('an explicit declaration overrides the arity probe (rest/default params fool arity)', () => {
    expect(readsDirection({ ...blindSpec, readsDirection: true })).toBe(true);
    expect(readsDirection({ ...awareSpec, readsDirection: false })).toBe(false);
  });
});

describe('ArchetypeStep — a fix that cannot work is not offered', () => {
  afterEach(cleanup);
  beforeEach(() => { useLabPipelineStore.setState({ byEntity: {} }); localStorage.clear(); });

  it('offers NO fix on an already-produced, direction-blind static step whose checker fails on content', () => {
    useLabPipelineStore.getState().produce(entity.id, 'Concept Brief', blindSpec.produce(entity));
    render(<ArchetypeStep t={t} entity={entity} step="Concept Brief" spec={blindSpec} />);
    expect(status()).toBe('fail');
    expect(screen.queryByTestId('acceptance-produce-fix')).toBeNull();
  });

  it('states plainly what WOULD change it, instead of previewing a dispatch that will not happen', () => {
    useLabPipelineStore.getState().produce(entity.id, 'Concept Brief', blindSpec.produce(entity));
    render(<ArchetypeStep t={t} entity={entity} step="Concept Brief" spec={blindSpec} />);
    const s = screen.getByTestId('acceptance-suggestion').textContent ?? '';
    expect(s).toMatch(/ignores the direction|direction-blind/i);
    // It must name the real remedy — a live CLI produce for a text archetype.
    expect(s).toMatch(/live/i);
    // …and it must not claim the button is about to dispatch anything.
    expect(s).not.toMatch(/Produce fix will dispatch/i);
  });

  it('a NEVER-produced step keeps today behaviour: the fix that DOES work is still offered and still works', async () => {
    render(<ArchetypeStep t={t} entity={entity} step="Concept Brief" spec={awareSpec} />);
    expect(status()).toBe('fail');
    fireEvent.click(screen.getByTestId('acceptance-produce-fix'));
    await act(async () => {});
    expect(status()).toBe('pass');
  });

  it('a direction-AWARE produced step keeps its fix, and the fix changes the stored content', async () => {
    // Produced, and FAILING on its content — the case the old suite never covered.
    useLabPipelineStore.getState().produce(entity.id, 'Concept Brief', { data: { brief: 'short' } });
    render(<ArchetypeStep t={t} entity={entity} step="Concept Brief" spec={awareSpec} />);
    const before = stepContentHash(dataNow());
    fireEvent.click(screen.getByTestId('acceptance-produce-fix'));
    await act(async () => {});
    expect(stepContentHash(dataNow())).not.toBe(before);
  });

  it('a never-produced direction-BLIND step still offers the fix — producing from nothing is a real change', () => {
    render(<ArchetypeStep t={t} entity={entity} step="Concept Brief" spec={blindSpec} />);
    expect(screen.getByTestId('acceptance-produce-fix')).toBeTruthy();
  });

  it('a deferred step still offers no fix (unchanged)', () => {
    const deferredSpec: StepSpec = {
      ...blindSpec,
      accept: (): AcceptanceResult => ({ label: 'Runtime gate', status: 'deferred', tier: 'L3', detail: 'needs UE', reason: 'runtime gate' }),
    };
    useLabPipelineStore.getState().produce(entity.id, 'Concept Brief', deferredSpec.produce(entity));
    render(<ArchetypeStep t={t} entity={entity} step="Concept Brief" spec={deferredSpec} />);
    expect(screen.queryByTestId('acceptance-produce-fix')).toBeNull();
  });

  it('a gallery step is untouched — its re-roll genuinely produces new candidates', () => {
    const gallerySpec: StepSpec = {
      archetype: 'gallery', label: 'Concept Brief',
      view: { kind: 'gallery', field: 'pick', candidates: 4 },
      produce: () => ({ data: { pick: -1 } }),
      accept: (data): AcceptanceResult =>
        typeof data.pick === 'number' && data.pick >= 0
          ? { label: 'Candidate selected', status: 'pass', tier: 'L1', detail: 'ok' }
          : { label: 'Candidate selected', status: 'fail', tier: 'L1', detail: 'none', reason: 'nothing selected' },
    };
    useLabPipelineStore.getState().produce(entity.id, 'Concept Brief', gallerySpec.produce(entity));
    render(<ArchetypeStep t={t} entity={entity} step="Concept Brief" spec={gallerySpec} />);
    expect(screen.getByTestId('acceptance-produce-fix')).toBeTruthy();
  });
});
