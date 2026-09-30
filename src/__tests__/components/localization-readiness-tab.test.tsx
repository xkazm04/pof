/**
 * Acceptance for localization-pipeline/B (scan-sweep --challenge run challenge-2026-09-30a):
 * the Readiness tab reads the SAME unit stream the scan produced (store strings/hazards),
 * says so honestly when it is the demo corpus or when a real project has 0 user-facing
 * strings, and the pseudo locale is built, never offered, never counted.
 *
 * setup.ts has no afterEach(cleanup) — see reference_test_no_autocleanup.
 */
import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { render, renderHook, screen, fireEvent, cleanup, act, within } from '@testing-library/react';
import { LocalizationPipelineView } from '@/components/modules/evaluator/LocalizationPipelineView';
import { useLocalizationPipelineView } from '@/components/modules/evaluator/LocalizationPipelineView/useLocalizationPipelineView';
import { useLocalizationPipelineStore } from '@/stores/localizationPipelineStore';
import { scanForLocalizableStrings } from '@/lib/localization/scan-engine';
import { PSEUDO_LOCALE } from '@/lib/localization/pseudo-locale';
import { SUPPORTED_LOCALES } from '@/lib/localization/definitions';
import type {
  LocalizationConfig,
  ScanProvenance,
  ScanResult,
  TranslationEntry,
} from '@/types/localization-pipeline';

afterEach(cleanup);

const CONFIG: LocalizationConfig = {
  rootNamespace: 'PoF',
  targetLocales: ['fr', 'de'],
  scanModules: [],
  glossary: [],
  autoApplyThreshold: 0.8,
};

const FIXTURE_PROVENANCE: ScanProvenance = {
  kind: 'fixture', root: null, filesScanned: 0, literalsSeen: 0, excluded: {}, truncated: false,
};

function seed(scan: ScanResult, provenance: ScanProvenance) {
  const entry: TranslationEntry | undefined = scan.strings[0] && {
    stringId: scan.strings[0].id,
    locale: 'fr',
    translatedText: 'Équiper',
    status: 'translated',
    translatorNotes: '',
    backTranslation: '',
    confidence: 0.9,
    expansionWarning: false,
    charDelta: 2,
  };
  useLocalizationPipelineStore.setState({
    config: CONFIG,
    scanResult: scan,
    scanProvenance: provenance,
    strings: scan.strings,
    hazards: scan.hazards,
    entries: entry ? [entry] : [],
    progress: { fr: 50, de: 0 },
    qaByLocale: {
      fr: { locale: 'fr', totalEntries: 1, findingCount: 0, criticalCount: 0, blockingCount: 0, readyToShip: true },
    },
    isLoading: false,
    error: null,
    fetchDefaults: async () => {},
  });
}

describe('useLocalizationPipelineView — readiness memo over the scan', () => {
  beforeEach(() => seed(scanForLocalizableStrings(), FIXTURE_PROVENANCE));

  it('case 7: summary.overflow counts overflow rows; knob toggles change pseudo, never verdicts', () => {
    const { result } = renderHook(() => useLocalizationPipelineView());
    const before = result.current.readiness;
    expect(before.summary.overflow).toBe(before.rows.filter((r) => r.verdict === 'overflow').length);
    expect(before.summary.overflow).toBeGreaterThan(0);

    act(() => result.current.setPseudoKnobs({ markers: false }));
    const after = result.current.readiness;
    expect(after.rows).toHaveLength(before.rows.length);
    expect(after.rows.some((r, i) => r.pseudo !== before.rows[i].pseudo)).toBe(true);
    expect(after.rows.map((r) => r.verdict)).toEqual(before.rows.map((r) => r.verdict));
  });
});

describe('Readiness tab', () => {
  it('case 8: overflow rows first; store untouched; pseudo locale never offered', () => {
    seed(scanForLocalizableStrings(), FIXTURE_PROVENANCE);
    const s0 = useLocalizationPipelineStore.getState();
    const { entries, progress, qaByLocale } = s0;

    render(<LocalizationPipelineView />);
    fireEvent.click(screen.getByRole('tab', { name: /readiness/i }));
    const panel = screen.getByRole('tabpanel');
    const rows = within(panel).getAllByTestId('readiness-row');
    const verdicts = rows.map((r) => r.getAttribute('data-verdict'));
    const firstNonOverflow = verdicts.findIndex((v) => v !== 'overflow');
    expect(firstNonOverflow).toBeGreaterThan(0);
    expect(verdicts.slice(firstNonOverflow)).not.toContain('overflow');

    const s1 = useLocalizationPipelineStore.getState();
    expect(s1.entries).toBe(entries);
    expect(s1.progress).toBe(progress);
    expect(s1.qaByLocale).toBe(qaByLocale);

    expect(SUPPORTED_LOCALES.map((l) => l.code)).not.toContain(PSEUDO_LOCALE);
    fireEvent.click(screen.getByRole('tab', { name: /translations/i }));
    const select = screen.getByLabelText(/filter translations by locale/i) as HTMLSelectElement;
    expect(Array.from(select.options).map((o) => o.value)).not.toContain(PSEUDO_LOCALE);
  });

  it('[honesty] the demo corpus is labelled as sample data, not the project', () => {
    seed(scanForLocalizableStrings(), FIXTURE_PROVENANCE);
    render(<LocalizationPipelineView />);
    fireEvent.click(screen.getByRole('tab', { name: /readiness/i }));
    expect(within(screen.getByRole('tabpanel')).getByTestId('readiness-provenance').textContent)
      .toMatch(/demo corpus.*not your project/i);
  });

  it('[honesty] a real project with 0 user-facing strings says so — no rows, no "all fit" claim', () => {
    const empty: ScanResult = {
      totalFilesScanned: 22, totalStringsFound: 0, hardcodedCount: 0, ftextFromStringCount: 0,
      alreadyLocalizedCount: 0, strings: [], hazards: [], moduleBreakdown: {},
    };
    seed(empty, { kind: 'project', root: 'C:/Proj', filesScanned: 22, literalsSeen: 170, excluded: {}, truncated: false });
    render(<LocalizationPipelineView />);

    const overviewLine = screen.getByTestId('readiness-summary');
    expect(overviewLine.textContent).toMatch(/no user-facing strings/i);
    expect(overviewLine.textContent).not.toMatch(/0 strings? will clip/i);

    fireEvent.click(screen.getByRole('tab', { name: /readiness/i }));
    const panel = screen.getByRole('tabpanel');
    expect(within(panel).queryAllByTestId('readiness-row')).toHaveLength(0);
    expect(panel.textContent).toMatch(/no user-facing strings.*C:\/Proj\/Source/i);
    expect(panel.textContent).not.toMatch(/all .*fit/i);
  });

  it('the Overview summary names the clip count and jumps to the Readiness tab', () => {
    seed(scanForLocalizableStrings(), FIXTURE_PROVENANCE);
    render(<LocalizationPipelineView />);
    const line = screen.getByTestId('readiness-summary');
    expect(line.textContent).toMatch(/\d+ strings? will clip/i);
    fireEvent.click(within(line).getByRole('button'));
    expect(screen.getByRole('tab', { name: /readiness/i }).getAttribute('aria-selected')).toBe('true');
  });
});
