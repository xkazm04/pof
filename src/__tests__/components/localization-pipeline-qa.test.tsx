/**
 * Tests for the "Automated translation QA validator" feature:
 *   - a dedicated QA sub-tab lists target-side findings with a one-click fix prompt
 *   - per-locale "ready to ship" badge gates on a clean (zero-blocking) QA run
 *   - the "QA" preset chip on the Translations tab filters to entries with findings
 *
 * setup.ts has no afterEach(cleanup) and no jest-dom matchers — assert plain DOM.
 */
import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { LocalizationPipelineView } from '@/components/modules/evaluator/LocalizationPipelineView';
import { useLocalizationPipelineStore } from '@/stores/localizationPipelineStore';
import type {
  LocalizableString,
  TranslationEntry,
  TranslationQAFinding,
  LocaleQAStatus,
  ScanResult,
  LocalizationConfig,
} from '@/types/localization-pipeline';

afterEach(cleanup);

const STR1: LocalizableString = {
  id: 'str-1',
  sourceText: 'Press {0} to start',
  context: 'ui_label',
  currentUsage: 'hardcoded',
  locNamespace: 'UI',
  locKey: 'PressStart',
  locations: [{ filePath: 'Source/UI/Menu.cpp', lineNumber: 42, columnStart: 1, columnEnd: 10, codeSnippet: 'x' }],
  sourceModule: 'arpg-ui',
  detectionConfidence: 0.95,
};
const STR2: LocalizableString = { ...STR1, id: 'str-2', sourceText: 'Inventory', locKey: 'Inventory' };

const ENTRIES: TranslationEntry[] = [
  { stringId: 'str-1', locale: 'de', translatedText: 'Drücke {0} zum Starten', status: 'translated', translatorNotes: '', backTranslation: '', confidence: 0.9, expansionWarning: false, charDelta: 0 },
  { stringId: 'str-2', locale: 'de', translatedText: 'Inventar', status: 'translated', translatorNotes: '', backTranslation: '', confidence: 0.9, expansionWarning: false, charDelta: 0 },
  { stringId: 'str-1', locale: 'fr', translatedText: 'Appuyez sur {0}', status: 'translated', translatorNotes: '', backTranslation: '', confidence: 0.9, expansionWarning: false, charDelta: 0 },
  { stringId: 'str-2', locale: 'fr', translatedText: 'Inventory', status: 'translated', translatorNotes: '', backTranslation: '', confidence: 0.9, expansionWarning: false, charDelta: 0 },
];

// One blocking finding: str-2/fr is identical to the English source.
const FINDING: TranslationQAFinding = {
  id: 'qa-1',
  stringId: 'str-2',
  locale: 'fr',
  check: 'untranslated',
  severity: 'warning',
  message: 'Translation is identical to the English source — likely untranslated.',
  sourceText: 'Inventory',
  translatedText: 'Inventory',
  suggestion: 'Translate "Inventory" into fr.',
  fixPrompt: 'Fix the untranslated QA failure in the fr translation of "Inventory" → "Inventory".',
};

const BY_LOCALE: Record<string, LocaleQAStatus> = {
  de: { locale: 'de', totalEntries: 2, findingCount: 0, criticalCount: 0, blockingCount: 0, readyToShip: true },
  fr: { locale: 'fr', totalEntries: 2, findingCount: 1, criticalCount: 0, blockingCount: 1, readyToShip: false },
};

const SCAN: ScanResult = {
  totalFilesScanned: 1,
  totalStringsFound: 2,
  hardcodedCount: 2,
  ftextFromStringCount: 0,
  alreadyLocalizedCount: 0,
  strings: [STR1, STR2],
  hazards: [],
  moduleBreakdown: { 'arpg-ui': { total: 2, hardcoded: 2, localized: 0 } },
};

const CONFIG: LocalizationConfig = {
  rootNamespace: 'PoF',
  targetLocales: ['de', 'fr'],
  scanModules: ['arpg-ui'],
  glossary: [],
  autoApplyThreshold: 0.85,
};

beforeEach(() => {
  useLocalizationPipelineStore.setState({
    config: CONFIG,
    scanResult: SCAN,
    strings: [STR1, STR2],
    hazards: [],
    entries: ENTRIES,
    qaFindings: [FINDING],
    qaByLocale: BY_LOCALE,
    isLoading: false,
    error: null,
    fetchDefaults: async () => {},
  });
});

describe('Translation QA validator UI', () => {
  it('exposes a QA sub-tab badged with the finding count', () => {
    render(<LocalizationPipelineView />);
    const qaTab = screen.getByRole('tab', { name: /QA/i });
    expect(qaTab.textContent).toContain('1');
  });

  it('lists QA findings and gates a per-locale "ready to ship" badge on a clean run', () => {
    render(<LocalizationPipelineView />);
    fireEvent.click(screen.getByRole('tab', { name: /QA/i }));

    // Clean locale (de) is ready to ship; blocked locale (fr) shows a fix count.
    expect(screen.queryByText(/^ready to ship$/i)).not.toBeNull();
    expect(screen.queryByText(/1 to fix/i)).not.toBeNull();

    // The finding is listed with its message.
    expect(screen.queryByText(/identical to the english source/i)).not.toBeNull();
  });

  it('reveals a one-click fix prompt when a finding card is expanded', () => {
    render(<LocalizationPipelineView />);
    fireEvent.click(screen.getByRole('tab', { name: /QA/i }));

    const card = screen.getByRole('button', { name: /identical to the english source/i });
    expect(card.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByRole('button', { name: /copy fix prompt/i })).toBeNull();

    fireEvent.click(card);
    expect(card.getAttribute('aria-expanded')).toBe('true');
    expect(screen.queryByRole('button', { name: /copy fix prompt/i })).not.toBeNull();
  });

  it('the "QA" preset chip filters Translations to entries with findings', () => {
    render(<LocalizationPipelineView />);
    fireEvent.click(screen.getByRole('tab', { name: /translations/i }));

    // All four entries shown before filtering.
    expect(screen.queryByText(/4 translations shown/i)).not.toBeNull();

    // The QA preset chip is a plain button (the sub-tab is role=tab, not button).
    fireEvent.click(screen.getByRole('button', { name: /^QA$/ }));

    // Only the single entry with a QA finding remains.
    expect(screen.queryByText(/1 translations shown/i)).not.toBeNull();
  });
});
