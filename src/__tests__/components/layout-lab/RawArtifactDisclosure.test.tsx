import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
vi.mock('next/font/google', () => { const f = () => ({ className: 'm' }); return { IBM_Plex_Mono: f, Inter: f, JetBrains_Mono: f }; });
import { RawArtifactDisclosure } from '@/components/layout-lab/steps/shared/RawArtifactDisclosure';
import { ArchetypeStep } from '@/components/layout-lab/steps/ArchetypeStep';
import { useLabPipelineStore } from '@/components/layout-lab/labPipelineStore';
import { LAB_THEMES } from '@/components/layout-lab/theme';
import { fieldsPopulated } from '@/lib/catalog/acceptance/dataCheckers';
import type { StepSpec } from '@/lib/catalog/stepSpec';

const t = LAB_THEMES[0];

describe('RawArtifactDisclosure', () => {
  afterEach(cleanup);

  it('is collapsed by default and serializes nothing until expanded', () => {
    render(<RawArtifactDisclosure t={t} data={{ brief: 'hi', wiringContract: { grantedBy: 'X' } }} />);
    expect(screen.getByTestId('raw-artifact-summary').textContent).toContain('2 fields');
    expect(screen.queryByTestId('raw-artifact-json')).toBeNull();
  });

  it('renders the stored payload verbatim when expanded', () => {
    render(<RawArtifactDisclosure t={t} data={{ brief: 'hi', nested: { a: 1 } }} ueAssets={['/Game/X']} verdict={{ status: 'pass', tier: 'L3' }} />);
    fireEvent.click(screen.getByTestId('raw-artifact-summary'));
    const json = screen.getByTestId('raw-artifact-json').textContent ?? '';
    const parsed = JSON.parse(json);
    expect(parsed.data).toEqual({ brief: 'hi', nested: { a: 1 } });
    expect(parsed.ueAssets).toEqual(['/Game/X']);
    expect(parsed.serverVerdict.tier).toBe('L3');
  });

  it('is honest about an unproduced step (no fabricated payload)', () => {
    render(<RawArtifactDisclosure t={t} data={{}} />);
    expect(screen.getByTestId('raw-artifact-summary').textContent).toContain('nothing produced yet');
    fireEvent.click(screen.getByTestId('raw-artifact-summary'));
    expect(screen.queryByTestId('raw-artifact-json')).toBeNull();
    expect(screen.getByText(/produced no artifact yet/)).toBeTruthy();
  });
});

describe('ArchetypeStep — every generic step exposes its raw artifact', () => {
  afterEach(cleanup);
  beforeEach(() => { useLabPipelineStore.setState({ byEntity: {} }); localStorage.clear(); });

  const entity = { id: 'e1', name: 'Ashen Forest', lifecycle: 'planned' as const, data: {} };
  const spec: StepSpec = {
    archetype: 'rules', label: 'Trigger & Progress',
    view: { kind: 'table', field: 'trigger', columns: [{ key: 'event' }] },
    produce: () => ({ data: { trigger: { event: 'Event.Combat.EnemyKilled', wiringContract: { grantedBy: 'Subsystem::OnKill' } } } }),
    accept: fieldsPopulated('trigger', 'Trigger populated', ['event']),
  };

  it('surfaces write-only produce payload (the wiringContract no View renders)', () => {
    render(<ArchetypeStep t={t} entity={entity} step="Trigger & Progress" spec={spec} />);
    fireEvent.click(screen.getByRole('button', { name: /Produce Trigger & Progress/ }));
    fireEvent.click(screen.getByTestId('raw-artifact-summary'));
    expect(screen.getByTestId('raw-artifact-json').textContent).toContain('wiringContract');
  });
});
