import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

vi.mock('next/font/google', () => {
  const font = () => ({ className: 'font', variable: '--font' });
  return { IBM_Plex_Mono: font, Inter: font, JetBrains_Mono: font };
});

import { CanonDriftPanel } from '@/components/layout-lab/CanonDriftPanel';
import { CanonView } from '@/components/layout-lab/CanonView';
import { useCanonStore } from '@/components/layout-lab/canonStore';
import { LIGHT } from '@/components/layout-lab/theme';
import { CANON_PROFILES } from '@/lib/catalog/canon/profiles';
import type { CanonDrift, CanonFinding } from '@/lib/catalog/canon/canonSync';

const finding = (id: string, verdict: CanonFinding['verdict']): CanonFinding => ({
  id, profile: 'diablo1', verdict, title: `Law ${id}`,
  dbBody: `old text of ${id}`, shippedBody: `shipped text of ${id}`,
  recordedHash: verdict === 'conflict' ? 'h-offer' : null, currentHash: `h-${id}`,
});

const DRIFT: CanonDrift = {
  total: 3,
  byProfile: { diablo1: { unrecorded: [finding('d1-a', 'unrecorded'), finding('d1-b', 'unrecorded')], conflict: [finding('d1-c', 'conflict')] } },
  adopted: [{ id: 'd1-z', profile: 'diablo1', adoptedAt: '2026-09-29 10:00:00', priorBody: 'the prior law' }],
};

type IdsAct = (ids: string[]) => Promise<void>;
let adopt: ReturnType<typeof vi.fn<IdsAct>>;
let keep: ReturnType<typeof vi.fn<IdsAct>>;
let undoAdopt: ReturnType<typeof vi.fn<IdsAct>>;

beforeEach(() => {
  adopt = vi.fn<IdsAct>(async () => {});
  keep = vi.fn<IdsAct>(async () => {});
  undoAdopt = vi.fn<IdsAct>(async () => {});
  useCanonStore.setState({ drift: DRIFT, loadDrift: vi.fn(async () => {}), adopt, keep, undoAdopt });
});

afterEach(() => { cleanup(); useCanonStore.setState({ drift: null }); });

describe('CanonDriftPanel', () => {
  it('shows the DB text beside the shipped text for every finding of the profile', () => {
    render(<CanonDriftPanel t={LIGHT} profileId="diablo1" />);
    for (const id of ['d1-a', 'd1-b', 'd1-c']) {
      expect(screen.getByText(`old text of ${id}`)).toBeTruthy();
      expect(screen.getByText(`shipped text of ${id}`)).toBeTruthy();
    }
  });

  it('bulk adopt previews the count and writes nothing until the operator confirms', () => {
    render(<CanonDriftPanel t={LIGHT} profileId="diablo1" />);
    fireEvent.click(screen.getByRole('button', { name: 'Adopt shipped for all 2 unrecorded' }));
    expect(adopt).not.toHaveBeenCalled();
    expect(screen.getByText(/2 rules will be overwritten with the shipped text/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Confirm adopt 2' }));
    expect(adopt).toHaveBeenCalledWith(['d1-a', 'd1-b']);
  });

  it('per-rule Keep mine / Adopt, and Undo on an adopted rule', () => {
    render(<CanonDriftPanel t={LIGHT} profileId="diablo1" />);
    fireEvent.click(screen.getByRole('button', { name: 'Keep mine d1-c' }));
    expect(keep).toHaveBeenCalledWith(['d1-c']);
    fireEvent.click(screen.getByRole('button', { name: 'Adopt shipped d1-a' }));
    expect(adopt).toHaveBeenCalledWith(['d1-a']);
    fireEvent.click(screen.getByRole('button', { name: 'Undo adopt d1-z' }));
    expect(undoAdopt).toHaveBeenCalledWith(['d1-z']);
  });

  it('CanonView banners the drift on the active profile tab and opens the review', () => {
    render(<CanonView t={LIGHT} />);
    expect(screen.queryByText(/changed upstream/)).toBeNull(); // PoF tab: no drift
    fireEvent.click(screen.getByRole('tab', { name: CANON_PROFILES.diablo1.title }));
    expect(screen.getByText(/3 laws changed upstream since this DB was seeded/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Review drift' }));
    expect(screen.getByText('shipped text of d1-a')).toBeTruthy();
  });
});
