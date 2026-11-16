import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { SubTabNavigation } from '@/components/modules/core-engine/unique-tabs/_shared/tabs';
import { SegmentedControl } from '@/components/modules/core-engine/unique-tabs/_shared/navigation';

afterEach(cleanup);

// framer shared-layout projection does not run in jsdom, so the instrument records the
// layoutId each active pill is rendered with: two strips sharing one id share one highlight.
const seen: string[] = [];
vi.mock('framer-motion', async () => {
  const React = await import('react');
  const strip = ({ layoutId, children, ...rest }: Record<string, unknown>) => {
    if (typeof layoutId === 'string') seen.push(layoutId);
    const { initial, animate, exit, transition, ...dom } = rest;
    void initial; void animate; void exit; void transition;
    return React.createElement('div', dom, children as React.ReactNode);
  };
  return {
    motion: { div: strip },
    AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
    useReducedMotion: () => false,
  };
});

const tabs = [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }];

describe('tab strips own their highlight identity', () => {
  it('two SubTabNavigation instances render distinct layoutIds', () => {
    seen.length = 0;
    render(<><SubTabNavigation tabs={tabs} activeTabId="a" onChange={() => {}} accent="red" />
      <SubTabNavigation tabs={tabs} activeTabId="b" onChange={() => {}} accent="red" /></>);
    expect(seen.length).toBe(2);
    expect(new Set(seen).size).toBe(2);
  });

  it('two SegmentedControl instances render distinct layoutIds', () => {
    seen.length = 0;
    render(<><SegmentedControl options={tabs} activeId="a" onChange={() => {}} accent="red" />
      <SegmentedControl options={tabs} activeId="b" onChange={() => {}} accent="red" /></>);
    expect(seen.length).toBe(2);
    expect(new Set(seen).size).toBe(2);
  });
});
