/**
 * A TRANSFERRED analysis must never wear the clothes of a hand-verified one
 * (direction: crash-signature-matching).
 *
 * Signature matching lets a known crash's root-cause analysis reach a crash it
 * was not written for. That is the feature — and it is also the moment the UI
 * could quietly overclaim, because the transferred card carries the same summary,
 * the same fix prompt, and (on an identical signature) the same confidence number
 * as the authored one. These pin the visible difference.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

// setup.ts has no afterEach(cleanup) — see reference_test_no_autocleanup.
afterEach(cleanup);

vi.mock('framer-motion', async (importOriginal) => {
  const actual = await importOriginal<typeof import('framer-motion')>();
  return { ...actual, useReducedMotion: () => false };
});
vi.mock('next/font/google', () => { const f = () => ({ className: 'm' }); return { IBM_Plex_Mono: f, Inter: f, JetBrains_Mono: f }; });

import { CrashAnalyzerView } from '@/components/modules/evaluator/CrashAnalyzerView';
import { ImportPanel } from '@/components/modules/evaluator/CrashAnalyzerView/ImportPanel';
import { useCrashAnalyzerStore } from '@/stores/crashAnalyzerStore';
import { parseCrashLog, analyzeSingleCrash } from '@/lib/crash-analyzer/analysis-engine';

/** A real log whose shape is identical to crash-001 (null ASC in ActivateAbility). */
const RAW_LOG = [
  '[2026.08.18-11.04.02:551][118]LogWindows: Error: Unhandled Exception: EXCEPTION_ACCESS_VIOLATION reading address 0x0000000000000000',
  '[2026.08.18-11.04.02:551][118]LogWindows: Error: [Callstack]',
  '[2026.08.18-11.04.02:551][118]LogWindows: Error: UnrealEditor-Engine!UAbilitySystemComponent::TryActivateAbility()',
  '[2026.08.18-11.04.02:551][118]LogWindows: Error: UnrealEditor-MyGame!AARPGCharacterBase::ActivateAbility() [Source/Character/ARPGCharacterBase.cpp:234]',
].join('\n');

/** Drive the real engine; only the HTTP hop is bypassed. */
function seedFromRealEngine() {
  const parsed = parseCrashLog(RAW_LOG);
  if (!parsed) throw new Error('fixture log failed to parse');
  const { report, diagnosis } = analyzeSingleCrash(parsed);
  useCrashAnalyzerStore.setState({
    reports: [report],
    diagnoses: diagnosis ? [diagnosis] : [],
    patterns: [],
    selectedCrashId: report.id,
    isLoading: false,
    error: null,
    fetchAnalysis: async () => {},
    importCrashLog: async (rawText: string) => {
      const p = parseCrashLog(rawText);
      if (!p) return null;
      const res = analyzeSingleCrash(p);
      useCrashAnalyzerStore.setState({
        reports: [res.report],
        diagnoses: res.diagnosis ? [res.diagnosis] : [],
        selectedCrashId: res.report.id,
      });
      return res.report;
    },
  });
  return { report, diagnosis };
}

describe('a matched crash gets a real diagnosis — labelled as borrowed', () => {
  it('attaches crash-001\'s analysis to an imported crash of the same shape', () => {
    const { diagnosis } = seedFromRealEngine();
    expect(diagnosis).not.toBeNull();
    expect(diagnosis!.match!.sourceCrashId).toBe('crash-001');
  });

  it('names the source crash and the similarity on the analysis card', () => {
    seedFromRealEngine();
    render(<CrashAnalyzerView />);
    fireEvent.click(screen.getByRole('button', { name: 'Technical' }));

    // The no-diagnosis notice must be GONE — there is a diagnosis now.
    expect(screen.queryByTestId('no-diagnosis-notice')).toBeNull();

    const provenance = screen.getByTestId('diagnosis-match-provenance');
    expect(provenance.textContent).toMatch(/crash-001/);
    expect(provenance.textContent).toMatch(/similarity 1\.00/);
    expect(provenance.textContent).toMatch(/not\s+for this crash/);
    expect(provenance.textContent).toMatch(/What matches/);
    expect(provenance.textContent).toMatch(/same culprit function/);
  });

  it('calls the confidence COMPUTED, not analyst judgement', () => {
    seedFromRealEngine();
    render(<CrashAnalyzerView />);
    fireEvent.click(screen.getByRole('button', { name: 'Technical' }));

    // The heading says the analysis was matched, not authored here…
    expect(screen.getByText(/Matched Root Cause Analysis/)).toBeTruthy();
    expect(screen.queryByText('AI Root Cause Analysis')).toBeNull();
    // …and the ring's caption says which kind of number it is showing.
    expect(document.body.textContent).toMatch(/computed confidence/);
    expect(document.body.textContent).not.toMatch(/analyst confidence — hand-written/);
  });

  it('warns that the fix prompt\'s file and line references belong to the source crash', () => {
    seedFromRealEngine();
    render(<CrashAnalyzerView />);
    fireEvent.click(screen.getByRole('button', { name: 'Technical' }));

    expect(document.body.textContent).toMatch(
      /Written for crash-001 — verify its file and line references/,
    );
  });

  it('the triage row says the finding is borrowed rather than leading with "AI:"', () => {
    seedFromRealEngine();
    render(<CrashAnalyzerView />);

    const list = screen.getByRole('listbox', { name: 'Crash reports' });
    expect(list.textContent).toMatch(/Matched crash-001 \(strong\)/);
    expect(list.textContent).not.toMatch(/\bAI: /);
    expect(list.textContent).not.toMatch(/No diagnosis/);
  });

  it('the import confirmation reports a transfer, not an analysis', async () => {
    seedFromRealEngine();
    render(<ImportPanel />);

    fireEvent.change(screen.getByRole('textbox'), { target: { value: RAW_LOG } });
    fireEvent.click(screen.getByRole('button', { name: /Parse & Import/ }));

    const result = await screen.findByTestId('import-result');
    expect(result.textContent).toMatch(/Matched crash-001 by signature \(1\.00\)/);
    expect(result.textContent).toMatch(/not written for this one/);
  });
});
