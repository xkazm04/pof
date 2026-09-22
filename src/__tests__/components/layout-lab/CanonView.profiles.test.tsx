import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';

vi.mock('next/font/google', () => {
  const font = () => ({ className: 'font', variable: '--font' });
  return { IBM_Plex_Mono: font, Inter: font, JetBrains_Mono: font };
});

import { CanonView } from '@/components/layout-lab/CanonView';
import { useCanonStore } from '@/components/layout-lab/canonStore';
import { LIGHT } from '@/components/layout-lab/theme';
import { CANON_PROFILES } from '@/lib/catalog/canon/profiles';
import type { ProjectRule } from '@/lib/catalog/canon/types';

const originalInheritedIds = CANON_PROFILES.diablo1.inheritsPof;
const testInheritedIds = originalInheritedIds.length > 0 ? originalInheritedIds : ['pof-test-inherited'];
const inheritedId = testInheritedIds[0]!;
let rules: ProjectRule[];

const selectDiablo = () => fireEvent.click(screen.getByRole('tab', { name: CANON_PROFILES.diablo1.title }));

beforeEach(() => {
  if (originalInheritedIds.length === 0) {
    (CANON_PROFILES.diablo1 as { inheritsPof: readonly string[] }).inheritsPof = testInheritedIds;
  }
  rules = [
    { id: 'pof-own', category: 'game', scope: 'global', title: 'PoF own rule', body: 'PoF only' },
    { id: 'pof-unrelated', category: 'art', scope: 'global', title: 'Unrelated PoF rule', body: 'Not inherited' },
    { id: inheritedId, category: 'project', scope: 'global', title: 'Inherited PoF rule', body: 'Shared convention' },
    { id: 'diablo-own', category: 'game', scope: 'global', title: 'Diablo own rule', body: 'Diablo only', profile: 'diablo1' },
  ];
  useCanonStore.setState({ rules });
});

afterEach(() => {
  cleanup();
  (CANON_PROFILES.diablo1 as { inheritsPof: readonly string[] }).inheritsPof = originalInheritedIds;
});

describe('CanonView profiles', () => {
  it('defaults to PoF and shows only PoF-owned rules', () => {
    render(<CanonView t={LIGHT} />);

    expect(screen.getByRole('heading', { name: `${CANON_PROFILES.pof.title} Canon` })).toBeTruthy();
    expect(screen.getByText('PoF own rule')).toBeTruthy();
    expect(screen.getByText('Inherited PoF rule')).toBeTruthy();
    expect(screen.queryByText('Diablo own rule')).toBeNull();
  });

  it('shows the selected profile own rules without unrelated PoF rules', () => {
    render(<CanonView t={LIGHT} />);
    selectDiablo();

    expect(screen.getByRole('heading', { name: `${CANON_PROFILES.diablo1.title} Canon` })).toBeTruthy();
    expect(screen.getByText('Diablo own rule')).toBeTruthy();
    expect(screen.queryByText('PoF own rule')).toBeNull();
    expect(screen.queryByText('Unrelated PoF rule')).toBeNull();
  });

  it('renders inherited PoF rules in a read-only block', () => {
    render(<CanonView t={LIGHT} />);
    selectDiablo();

    const inherited = screen.getByRole('region', { name: 'Inherited from PoF' });
    expect(within(inherited).getByText('Inherited PoF rule')).toBeTruthy();
    expect(within(inherited).queryByRole('button', { name: 'Edit' })).toBeNull();
    expect(within(inherited).queryByRole('button', { name: 'Delete' })).toBeNull();
  });

  it('adds new rules to the selected profile', () => {
    render(<CanonView t={LIGHT} />);
    selectDiablo();
    fireEvent.click(screen.getAllByRole('button', { name: '+ Add rule' })[0]);

    const added = useCanonStore.getState().rules.find((rule) => !rules.some((existing) => existing.id === rule.id));
    expect(added?.category).toBe('game');
    expect(added?.profile).toBe('diablo1');
  });
});
