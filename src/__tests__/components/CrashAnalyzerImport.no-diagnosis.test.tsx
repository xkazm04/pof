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
import type { CrashReport } from '@/types/crash-analyzer';

/** A real-shaped UE5 crash log — the kind a user actually pastes in. */
const RAW_LOG = [
  '[2026.08.18-09.12.44:120][842]LogWindows: Error: Unhandled Exception: EXCEPTION_ACCESS_VIOLATION reading address 0x0000000000000000',
  '[2026.08.18-09.12.44:120][842]LogWindows: Error:',
  '[2026.08.18-09.12.44:120][842]LogWindows: Error: [Callstack]',
  '[2026.08.18-09.12.44:120][842]LogWindows: Error: UnrealEditor-MyGame!UARPGInventoryComponent::AddItem() [Source/Inventory/ARPGInventoryComponent.cpp:142]',
  '[2026.08.18-09.12.44:120][842]LogWindows: Error: UnrealEditor-MyGame!AARPGCharacterBase::PickupItem() [Source/Character/ARPGCharacterBase.cpp:401]',
].join('\n');

function importedCrash(): CrashReport {
  const parsed = parseCrashLog(RAW_LOG);
  if (!parsed) throw new Error('fixture log failed to parse');
  return analyzeSingleCrash(parsed).report;
}

/**
 * Seed the store the way the real one ends up after an import, but drive the
 * import through the REAL engine functions (only the HTTP hop is bypassed), so
 * the "no diagnosis" fact under test is produced by production code.
 */
function seedImportable() {
  useCrashAnalyzerStore.setState({
    reports: [],
    diagnoses: [],
    patterns: [],
    selectedCrashId: null,
    isLoading: false,
    error: null,
    importCrashLog: async (rawText: string) => {
      const parsed = parseCrashLog(rawText);
      if (!parsed) return null;
      const { report, diagnosis } = analyzeSingleCrash(parsed);
      useCrashAnalyzerStore.setState({
        reports: [report],
        diagnoses: diagnosis ? [diagnosis] : [],
        selectedCrashId: report.id,
      });
      return report;
    },
  });
}

/* ------------------------------------------------------------------ */
/*  The engine fact                                                    */
/* ------------------------------------------------------------------ */

describe('an imported crash never receives a diagnosis', () => {
  it('parses, attributes a module, and returns diagnosis: null', () => {
    const parsed = parseCrashLog(RAW_LOG);
    expect(parsed).not.toBeNull();

    const { report, diagnosis } = analyzeSingleCrash(parsed!);

    // The lookup is exact-id equality against crash-001..crash-008, and an
    // imported crash is stamped `crash-<timestamp>` — so it can never match.
    expect(report.id).not.toMatch(/^crash-00\d$/);
    expect(diagnosis).toBeNull();

    // Parsing DID succeed and did real work — that is what may be claimed.
    expect(report.crashType).toBe('nullptr_deref');
    expect(report.callstack).toHaveLength(2);
    expect(report.mappedModule).toBe('arpg-inventory');
  });
});

/* ------------------------------------------------------------------ */
/*  The import confirmation                                            */
/* ------------------------------------------------------------------ */

describe('ImportPanel — reports what actually happened', () => {
  it('says the log was parsed and that no diagnosis matched', async () => {
    seedImportable();
    render(<ImportPanel />);

    fireEvent.change(screen.getByRole('textbox'), { target: { value: RAW_LOG } });
    fireEvent.click(screen.getByRole('button', { name: /Parse & Import/ }));

    const result = await screen.findByTestId('import-result');
    expect(result.textContent).toMatch(/Parsed crash/);
    expect(result.textContent).toMatch(/No diagnosis matched/);
    // It must not read as though an analysis succeeded.
    expect(result.textContent).not.toMatch(/analyzed|diagnosis attached/i);
  });
});

/* ------------------------------------------------------------------ */
/*  The rendered crash                                                 */
/* ------------------------------------------------------------------ */

describe('an imported crash is NOT presented as a diagnosis', () => {
  function seedRendered() {
    const report = importedCrash();
    useCrashAnalyzerStore.setState({
      reports: [report],
      diagnoses: [],
      patterns: [],
      selectedCrashId: report.id,
      isLoading: false,
      error: null,
      fetchAnalysis: async () => {},
    });
    return report;
  }

  it('plain mode: says there is no diagnosis and fences off the category guidance', () => {
    seedRendered();
    render(<CrashAnalyzerView />);

    const notice = screen.getByTestId('no-diagnosis-notice');
    expect(notice.textContent).toMatch(/No diagnosis for this crash/);
    expect(notice.textContent).toMatch(/not match any of them/);

    // The generic advice is still there — under headings that say it is generic.
    expect(screen.getByText('Typical cause')).toBeTruthy();
    expect(screen.getByText('Where to start')).toBeTruthy();
    expect(notice.textContent).toMatch(/General guidance for/i);

    // …and NOT under the headings a real diagnosis owns.
    expect(screen.queryByText('What happened')).toBeNull();
    expect(screen.queryByText('What to do')).toBeNull();
  });

  it('shows the absence of a confidence rather than an implied certainty', () => {
    seedRendered();
    render(<CrashAnalyzerView />);

    expect(screen.getByTestId('no-diagnosis-notice').textContent).toMatch(/confidence: none/);
    // No percentage anywhere — a fabricated low confidence would be the same
    // overclaim in a quieter voice.
    expect(document.body.textContent).not.toMatch(/confidence \d+%/);
    expect(screen.getByText('No diagnosis')).toBeTruthy(); // the list row says so too
  });

  it('technical mode carries the same statement, not an empty analysis slot', () => {
    seedRendered();
    render(<CrashAnalyzerView />);

    fireEvent.click(screen.getByRole('button', { name: 'Technical' }));

    expect(screen.queryByTestId('plain-crash-summary')).toBeNull();
    expect(screen.getByText(/^Callstack/)).toBeTruthy();
    expect(screen.getByTestId('no-diagnosis-notice')).toBeTruthy();
    expect(screen.queryByText('AI Root Cause Analysis')).toBeNull();
  });
});
