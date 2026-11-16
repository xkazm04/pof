/**
 * The three crash-analyzer height disclosures (detail "technical details", pattern
 * card, raw log) must route their transition through motionSafe(useReducedMotion),
 * like the detail slide and the Time Machine already do.
 */
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import React from 'react';
import { render, cleanup, fireEvent } from '@testing-library/react';

const seen: Array<Record<string, unknown> | undefined> = [];
let reduced = false;

vi.mock('framer-motion', () => {
  const motion = new Proxy({}, {
    get: (_t, tag: string) => (props: Record<string, unknown>) => {
      const { transition, children, ...rest } = props;
      for (const k of ['initial', 'animate', 'exit']) delete rest[k];
      seen.push(transition as Record<string, unknown> | undefined);
      return React.createElement(tag, rest, children as React.ReactNode);
    },
  });
  return {
    motion,
    AnimatePresence: ({ children }: { children: React.ReactNode }) => React.createElement(React.Fragment, null, children),
    useReducedMotion: () => reduced,
  };
});

import { CrashDetailPanel } from '@/components/modules/evaluator/CrashAnalyzerView/CrashDetailPanel';
import { PatternCard } from '@/components/modules/evaluator/CrashAnalyzerView/PatternCard';
import { RawLogDisclosure } from '@/components/modules/evaluator/CrashAnalyzerView/RawLog';
import { SAMPLE_CRASHES } from '@/lib/crash-analyzer/sample-crashes';
import type { CrashPattern } from '@/types/crash-analyzer';

const pattern: CrashPattern = {
  id: 'p1', name: 'n', description: 'd', occurrences: 2, crashIds: [], crashType: 'nullptr_deref',
  signatureFunctions: [], isSystemic: false, rootCause: 'rc', firstSeen: '2026-01-01', lastSeen: '2026-01-02',
};

beforeEach(() => { seen.length = 0; });
afterEach(cleanup);

function openAll(container: HTMLElement) {
  const toggles = container.querySelectorAll('button[aria-expanded]');
  toggles.forEach((b) => fireEvent.click(b));
}

const cases: Array<[string, () => React.ReactElement]> = [
  ['CrashDetailPanel', () => <CrashDetailPanel report={SAMPLE_CRASHES[0]} diagnosis={null} onClose={() => {}} plainMode />],
  ['PatternCard', () => <PatternCard pattern={pattern} plainMode={false} />],
  ['RawLogDisclosure', () => <RawLogDisclosure rawLog="log" />],
];

describe.each(cases)('%s height disclosure', (_name, make) => {
  it('is instant when the user prefers reduced motion', () => {
    reduced = true;
    const { container } = render(make());
    openAll(container);
    expect(seen.length).toBeGreaterThan(0);
    expect(seen.every((t) => t?.duration === 0)).toBe(true);
  });

  it('keeps its tween otherwise', () => {
    reduced = false;
    const { container } = render(make());
    openAll(container);
    expect(seen.length).toBeGreaterThan(0);
    expect(seen.every((t) => typeof t?.duration === 'number' && t.duration > 0)).toBe(true);
  });
});
