import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import type { FeatureRow } from '@/types/feature-matrix';
import { STATUS_INFO } from '@/lib/chart-colors';

/**
 * 'Give Them Brains' follows the enemy you picked (scan-sweep --challenge,
 * bestiary-archetypes-ai/B): the AI Logic tab draws the subject's declared sense,
 * derives detection from it, and lists the subject's real behaviour gaps.
 */

// setup.ts has no afterEach(cleanup) — see reference_test_no_autocleanup.
afterEach(cleanup);

// Same framer-motion stand-in as PerceptionConeViz.test.tsx: motion.* become plain
// elements that stamp their `transition` onto data-transition.
const FRAMER_PROPS = new Set([
  'initial', 'animate', 'exit', 'transition', 'variants', 'layout', 'layoutId',
  'whileHover', 'whileTap', 'whileInView', 'whileFocus', 'whileDrag', 'drag',
]);
vi.mock('framer-motion', async (importOriginal) => {
  const actual = await importOriginal<typeof import('framer-motion')>();
  const React = await import('react');
  const motion = new Proxy({} as Record<string, unknown>, {
    get: (_t, tag: string) =>
      function MockMotion(props: Record<string, unknown> & { children?: React.ReactNode }) {
        const domProps: Record<string, unknown> = {
          'data-transition': JSON.stringify(props.transition ?? null),
        };
        for (const key of Object.keys(props)) {
          if (key !== 'children' && !FRAMER_PROPS.has(key)) domProps[key] = props[key];
        }
        return React.createElement(tag, domProps, props.children);
      },
  });
  return { ...actual, motion, useReducedMotion: () => false };
});

import { PerceptionConeViz } from '@/components/modules/core-engine/sub_bestiary/ai-logic/PerceptionConeViz';
import { AILogicTab } from '@/components/modules/core-engine/sub_bestiary/ai-logic/AILogicTab';
import { ARCHETYPES, DETECTED_ENTITIES } from '@/components/modules/core-engine/sub_bestiary/_shared/data';
import { senseProfileFor, detectEntities } from '@/lib/bestiary/sense-profile';

const RAKGHOUL = ARCHETYPES.find(a => a.id === 'rakghoul')!;

function pulseDurations(container: HTMLElement): number[] {
  return Array.from(container.querySelectorAll('[data-testid="perception-pulse"]'))
    .map(el => (JSON.parse(el.getAttribute('data-transition') || 'null') as { duration: number }).duration)
    .sort((a, b) => a - b);
}

function renderTab(subjectId: string | null, onSubjectChange = vi.fn()) {
  const utils = render(
    <AILogicTab featureMap={new Map<string, FeatureRow>()} accent={STATUS_INFO}
      subjectId={subjectId} onSubjectChange={onSubjectChange} />,
  );
  return { ...utils, onSubjectChange };
}

describe('PerceptionConeViz sense profile', () => {
  it('[guard] with no profile it renders today\'s diagram: 1500cm / 800cm and two pulses', () => {
    const { container } = render(<PerceptionConeViz entities={DETECTED_ENTITIES} />);
    expect(screen.getByText('1500cm')).toBeTruthy();
    expect(screen.getByText('800cm')).toBeTruthy();
    expect(pulseDurations(container)).toEqual([1.8, 2.6]);
  });

  it('with Rakghoul\'s profile it draws an 800cm ring, no 1500cm cone, and no pulse', () => {
    const profile = senseProfileFor(RAKGHOUL);
    const { container } = render(
      <PerceptionConeViz entities={detectEntities(DETECTED_ENTITIES, profile)} profile={profile} />,
    );
    expect(screen.getByText('800cm')).toBeTruthy();
    expect(screen.queryByText('1500cm')).toBeNull();
    expect(container.querySelector('[data-testid="perception-cone"]')).toBeNull();
    expect(pulseDurations(container)).toEqual([]);
  });
});

describe('AILogicTab follows the picked enemy', () => {
  it('subject rakghoul: header, its 800cm sense, and its patrol / retreat gaps', () => {
    const { container } = renderTab('rakghoul');
    expect(screen.getByRole('heading', { name: 'Brains of: Rakghoul' })).toBeTruthy();
    expect(screen.getByText('800cm')).toBeTruthy();
    expect(screen.queryByText('1500cm')).toBeNull();
    expect(pulseDurations(container)).toEqual([]);
    expect(screen.getByTestId('coverage-patrol').textContent).toContain('Patrol / idle');
    expect(screen.getByTestId('coverage-patrol').getAttribute('data-covered')).toBe('false');
    expect(screen.getByTestId('coverage-retreat').textContent).toContain('Retreat / flee');
    expect(screen.getByTestId('coverage-retreat').getAttribute('data-covered')).toBe('false');
    expect(screen.getByTestId('coverage-aggro').textContent).toContain('Proximity 8m');
    expect(screen.getByTestId('coverage-aggro').getAttribute('data-covered')).toBe('true');
    // Legend states the subject's sense, not the generic one.
    expect(screen.queryByText('60 deg, 1500cm')).toBeNull();
  });

  it('subject null: today\'s generic view, no subject header or coverage strip', () => {
    const { container } = renderTab(null);
    expect(screen.queryByRole('heading', { name: /Brains of:/ })).toBeNull();
    expect(screen.queryByTestId('coverage-patrol')).toBeNull();
    expect(screen.getByText('1500cm')).toBeTruthy();
    expect(screen.getByText('800cm')).toBeTruthy();
    expect(screen.getByText('60 deg, 1500cm')).toBeTruthy();
    expect(pulseDurations(container)).toEqual([1.8, 2.6]);
  });

  it('the subject bar picks an enemy and clears back to the generic view', () => {
    const { onSubjectChange } = renderTab('rakghoul');
    fireEvent.change(screen.getByLabelText('Brain subject'), { target: { value: 'kinrath' } });
    expect(onSubjectChange).toHaveBeenLastCalledWith('kinrath');
    fireEvent.click(screen.getByRole('button', { name: 'Clear brain subject' }));
    expect(onSubjectChange).toHaveBeenLastCalledWith(null);
  });
});
