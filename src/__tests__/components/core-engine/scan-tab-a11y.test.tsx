/**
 * ScanTab / TelemetryEvolution control semantics (scan-sweep night 2026-11-08,
 * core-engine-scan-telemetry). Plain DOM assertions — no jest-dom.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';
import { FindingRow } from '@/components/modules/core-engine/ScanTab/FindingRow';
import type { ScanFinding } from '@/types/scan';
import { ScanDelta } from '@/components/modules/core-engine/ScanTab/ScanDelta';
import { ResolvedSection } from '@/components/modules/core-engine/ScanTab/ResolvedSection';
import { SuggestionsList } from '@/components/modules/core-engine/TelemetryEvolution/SuggestionsList';
import type { GenreEvolutionSuggestion } from '@/types/telemetry';

vi.mock('@/components/modules/core-engine/GenreTemplateGallery', () => ({ GenreTemplateGallery: () => null }));

afterEach(cleanup);

function finding(): ScanFinding {
  return {
    id: 'f1', pass: 'quality', category: 'Null guard', severity: 'high',
    file: 'Source/Combat.cpp', line: 12, description: 'Missing null check', suggestedFix: 'Guard it',
    effort: 'small', foundAt: '2026-11-08T00:00:00Z',
  };
}

describe('FindingRow — selection and disclosure semantics', () => {
  function renderRow(selected: boolean, isExpanded: boolean) {
    return render(
      <FindingRow
        finding={finding()} isExpanded={isExpanded} onToggle={() => {}} onResolve={() => {}}
        onFix={() => {}} isRunning={false} selected={selected} onSelect={() => {}}
      />,
    );
  }

  it('the icon-only selection checkbox has a name and states its checked state', () => {
    const { container } = renderRow(true, false);
    const box = container.querySelector('[role="checkbox"]');
    expect(box).not.toBeNull();
    expect(box?.getAttribute('aria-checked')).toBe('true');
    expect(box?.getAttribute('aria-label') ?? '').toContain('Null guard');
    cleanup();
    const again = renderRow(false, false).container.querySelector('[role="checkbox"]');
    expect(again?.getAttribute('aria-checked')).toBe('false');
  });

  it('the row disclosure button states whether the details are expanded', () => {
    const collapsed = renderRow(false, false).container.querySelector('button[aria-expanded]');
    expect(collapsed?.getAttribute('aria-expanded')).toBe('false');
    cleanup();
    const expanded = renderRow(false, true).container.querySelector('button[aria-expanded]');
    expect(expanded?.getAttribute('aria-expanded')).toBe('true');
    expect(expanded?.textContent ?? '').toContain('Missing null check');
  });

  it('clicking the checkbox still selects without toggling the row', () => {
    let selects = 0; let toggles = 0;
    const { container } = render(
      <FindingRow
        finding={finding()} isExpanded={false} onToggle={() => { toggles += 1; }} onResolve={() => {}}
        onFix={() => {}} isRunning={false} selected={false} onSelect={() => { selects += 1; }}
      />,
    );
    fireEvent.click(container.querySelector('[role="checkbox"]') as Element);
    expect(selects).toBe(1);
    expect(toggles).toBe(0);
  });
});

describe('disclosure buttons state their expanded state', () => {
  it('ResolvedSection toggle flips aria-expanded', () => {
    const { container } = render(<ResolvedSection findings={[{ ...finding(), resolvedAt: '2026-11-08T01:00:00Z' }]} />);
    const btn = container.querySelector('button') as HTMLElement;
    expect(btn.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(btn);
    expect(btn.getAttribute('aria-expanded')).toBe('true');
  });

  it('SuggestionsList header states whether its details are open', () => {
    const sug: GenreEvolutionSuggestion = {
      id: 's1', subGenre: 'souls-like', label: 'Lean souls-like', description: 'd', confidence: 70,
      patterns: [], status: 'pending', proposedChanges: { prioritize: [], deprioritize: [], add: [] },
      createdAt: '2026-11-08T00:00:00Z', resolvedAt: null,
    };
    const closed = render(<SuggestionsList suggestions={[sug]} expandedId={null} onToggle={() => {}} onResolve={() => {}} />);
    expect(closed.container.querySelector('button')?.getAttribute('aria-expanded')).toBe('false');
    cleanup();
    const open = render(<SuggestionsList suggestions={[sug]} expandedId="s1" onToggle={() => {}} onResolve={() => {}} />);
    expect(open.container.querySelector('button')?.getAttribute('aria-expanded')).toBe('true');
  });
});

describe('ScanDelta — every transient state is a live region', () => {
  const noop = () => Promise.resolve();
  it('the pending "waiting for its report" line is announced like the unrecorded one', () => {
    const pending = render(<ScanDelta state={{ status: 'pending' }} onResolve={noop} lastResolved={null} onUndo={noop} resolveError={null} />);
    expect(pending.container.querySelector('[role="status"]')?.textContent ?? '').toContain('waiting for its report');
    cleanup();
    const unrecorded = render(<ScanDelta state={{ status: 'unrecorded', reason: 'r' }} onResolve={noop} lastResolved={null} onUndo={noop} resolveError={null} />);
    expect(unrecorded.container.querySelector('[role="status"]')).not.toBeNull();
  });
});
