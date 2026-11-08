/**
 * ScanTab / TelemetryEvolution control semantics (scan-sweep night 2026-11-08,
 * core-engine-scan-telemetry). Plain DOM assertions — no jest-dom.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';
import { FindingRow } from '@/components/modules/core-engine/ScanTab/FindingRow';
import type { ScanFinding } from '@/types/scan';

afterEach(cleanup);

function finding(): ScanFinding {
  return {
    id: 'f1', moduleId: 'arpg-combat', pass: 'quality', category: 'Null guard', severity: 'high',
    file: 'Source/Combat.cpp', line: 12, description: 'Missing null check', suggestedFix: 'Guard it',
    effort: 'small', createdAt: '2026-11-08T00:00:00Z',
  } as ScanFinding;
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
