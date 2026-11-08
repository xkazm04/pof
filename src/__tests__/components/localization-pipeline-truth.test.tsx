/**
 * Truthfulness guards for the Localization Pipeline view (scan-sweep 2026-11-08):
 * every claim the view paints — a "Copied!" receipt, a copied CSV, a bar width,
 * a ship verdict, a filter result — must match what actually happened.
 *
 * setup.ts has no afterEach(cleanup) and no jest-dom matchers — assert plain DOM.
 * No translation/LLM provider is called: every test drives components with fixtures.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import { HazardCard } from '@/components/modules/evaluator/LocalizationPipelineView/HazardCard';
import { QAFindingCard } from '@/components/modules/evaluator/LocalizationPipelineView/QAFindingCard';
import { ReplacementCard } from '@/components/modules/evaluator/LocalizationPipelineView/ReplacementCard';
import { StringTableCard } from '@/components/modules/evaluator/LocalizationPipelineView/StringTableCard';
import { TranslationCard } from '@/components/modules/evaluator/LocalizationPipelineView/TranslationCard';
import { OverviewTab } from '@/components/modules/evaluator/LocalizationPipelineView/OverviewTab';
import { QATab } from '@/components/modules/evaluator/LocalizationPipelineView/QATab';
import { LocalizationPipelineView } from '@/components/modules/evaluator/LocalizationPipelineView';
import { useLocalizationPipelineStore } from '@/stores/localizationPipelineStore';
import { ExpansionFactorBars } from '@/components/modules/evaluator/LocalizationPipelineView/ExpansionFactorBars';
import type {
  LocalizationHazard,
  TranslationQAFinding,
  LOCTEXTReplacementSuggestion,
  StringTable,
  TranslationEntry,
  ScanResult,
  LocalizableString,
  LocalizationConfig,
} from '@/types/localization-pipeline';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const HAZARD = {
  id: 'hz-1',
  type: 'string_concatenation',
  severity: 'critical',
  description: 'Concatenated UI text',
  suggestion: 'Use FText::Format',
  location: { filePath: 'Source/UI/Hud.cpp', lineNumber: 12, columnStart: 1, columnEnd: 5, codeSnippet: 'x' },
  fixPrompt: 'Fix the concatenation',
} as unknown as LocalizationHazard;

const FINDING: TranslationQAFinding = {
  id: 'qa-1',
  stringId: 'str-1',
  locale: 'fr',
  check: 'untranslated',
  severity: 'warning',
  message: 'Translation is identical to the English source.',
  sourceText: 'Inventory',
  translatedText: 'Inventory',
  suggestion: 'Translate it.',
  fixPrompt: 'Fix the untranslated string',
};

const REPLACEMENT = {
  stringId: 'str-1',
  originalCode: 'TEXT("Inventory")',
  suggestedCode: 'LOCTEXT("Inventory", "Inventory")',
} as unknown as LOCTEXTReplacementSuggestion;

const TABLE: StringTable = {
  tableId: 'ST_PoF_UI',
  namespace: 'PoF.UI',
  rows: [{ key: 'Interact', sourceString: 'Press "E" to interact', comment: '[ui_label] from arpg-ui' }],
} as StringTable;

/** A clipboard whose write the platform rejects (insecure context / no focus). */
function stubRejectingClipboard() {
  const writeText = vi.fn().mockRejectedValue(new Error('NotAllowedError'));
  vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });
  return writeText;
}

function stubCapturingClipboard() {
  const writeText = vi.fn().mockResolvedValue(undefined);
  vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });
  return writeText;
}

async function press(name: RegExp) {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name }));
  });
}

describe('copy buttons report the verified write, not the attempt', () => {
  const cases: [string, () => void, RegExp][] = [
    ['HazardCard', () => {
      render(<HazardCard hazard={HAZARD} />);
      fireEvent.click(screen.getByRole('button', { name: /concatenated ui text/i }));
    }, /copy fix prompt/i],
    ['QAFindingCard', () => {
      render(<QAFindingCard finding={FINDING} />);
      fireEvent.click(screen.getByRole('button', { name: /identical to the english source/i }));
    }, /copy fix prompt/i],
    ['ReplacementCard', () => render(<ReplacementCard replacement={REPLACEMENT} />), /copy suggested/i],
    ['StringTableCard', () => render(<StringTableCard table={TABLE} />), /copy csv/i],
  ];

  for (const [name, mount, button] of cases) {
    it(`${name}: a rejected clipboard write never shows "Copied!" and says it failed`, async () => {
      const writeText = stubRejectingClipboard();
      mount();
      await press(button);
      expect(writeText).toHaveBeenCalledTimes(1);
      expect(document.body.textContent).not.toContain('Copied!');
      expect(document.body.textContent).toContain('Copy failed');
    });

    it(`${name}: a successful write shows "Copied!"`, async () => {
      stubCapturingClipboard();
      mount();
      await press(button);
      expect(document.body.textContent).toContain('Copied!');
    });
  }
});

describe('String Table CSV copy is RFC 4180 (UE string-table import format)', () => {
  it('doubles embedded quotes so a quoted source string stays one field', async () => {
    const writeText = stubCapturingClipboard();
    render(<StringTableCard table={TABLE} />);
    await press(/copy csv/i);
    const csv = writeText.mock.calls[0][0] as string;
    const [, row] = csv.split('\n');
    expect(row).toBe('"Interact","Press ""E"" to interact","[ui_label] from arpg-ui"');
  });
});

describe('expansion bars share one scale', () => {
  const widthFor = (root: HTMLElement, label: string) => {
    const pct = Array.from(root.querySelectorAll<HTMLElement>('[style*="width"]'))
      .map((el) => el.style.width)
      .filter((w) => w.endsWith('%'));
    return { label, pct };
  };

  it('a German TranslationCard bar matches the Overview ExpansionFactorBars width', () => {
    const entry: TranslationEntry = {
      stringId: 'str-1', locale: 'de', translatedText: 'Inventar', status: 'translated',
      translatorNotes: '', backTranslation: '', confidence: 0.9, expansionWarning: false, charDelta: 0,
    };
    const card = render(<TranslationCard entry={entry} sourceText="Inventory" />);
    const cardWidth = widthFor(card.container, 'card').pct[0];
    cleanup();
    const bars = render(<ExpansionFactorBars />);
    // German (x1.35) is the widest locale, so it is the first sorted bar.
    const overviewWidth = widthFor(bars.container, 'overview').pct[0];
    expect(cardWidth).toBe(overviewWidth);
  });
});

describe('Overview names every string that needs conversion', () => {
  it('shows the FText::FromString count even when no raw hardcoded strings remain', () => {
    const scan = {
      totalFilesScanned: 1, totalStringsFound: 5, hardcodedCount: 0, ftextFromStringCount: 3,
      alreadyLocalizedCount: 2, strings: [], hazards: [], moduleBreakdown: {},
    } as ScanResult;
    render(
      <OverviewTab
        scanResult={scan} locReadiness={40} localizedCount={2} totalStrings={5}
        hardcoded={0} ftextCount={3} progress={{}} expansionIssues={{}} qaByLocale={{}}
        replacements={[]}
        readiness={{ total: 0, overflow: 0, nearBudget: 0, bypassesCatalog: 0, fragments: 0, fits: 0, reflow: 0, unbudgeted: 0 }}
        scanProvenance={null} onOpenReadiness={() => {}}
      />,
    );
    expect(document.body.textContent).toContain('3 FText::FromString need conversion');
  });
});

describe('QA tab never claims every locale ships when one has no data', () => {
  const ready = { locale: 'de', totalEntries: 2, findingCount: 0, criticalCount: 0, blockingCount: 0, readyToShip: true };

  it('a target locale with no QA status is not counted as clear to ship', () => {
    render(<QATab findings={[]} byLocale={{ de: ready }} targetLocales={['de', 'fr']} hasTranslations />);
    expect(document.body.textContent).toContain('no data');
    expect(document.body.textContent).not.toContain('Every locale is clear to ship');
    expect(document.body.textContent).toContain('1 of 2 locales clear to ship');
  });

  it('says every locale is clear only when each target locale is ready', () => {
    render(<QATab findings={[]} byLocale={{ de: ready, fr: { ...ready, locale: 'fr' } }} targetLocales={['de', 'fr']} hasTranslations />);
    expect(document.body.textContent).toContain('Every locale is clear to ship');
  });
});

// ── Whole-view fixtures (store seeded directly; no route, no provider) ──────
const BASE_STR: LocalizableString = {
  id: 'str-1', sourceText: 'Press start', context: 'ui_label', currentUsage: 'hardcoded',
  locNamespace: 'UI', locKey: 'PressStart',
  locations: [{ filePath: 'Source/UI/Menu.cpp', lineNumber: 42, columnStart: 1, columnEnd: 10, codeSnippet: 'x' }],
  sourceModule: 'arpg-ui', detectionConfidence: 0.95,
};
const entryFor = (stringId: string, locale: string): TranslationEntry => ({
  stringId, locale, translatedText: `${locale}:${stringId}`, status: 'translated',
  translatorNotes: '', backTranslation: '', confidence: 0.9, expansionWarning: false, charDelta: 0,
});
const VIEW_CONFIG: LocalizationConfig = {
  rootNamespace: 'PoF', targetLocales: ['de', 'fr'], scanModules: ['arpg-ui'], glossary: [], autoApplyThreshold: 0.85,
};

function seedView(strings: LocalizableString[], entries: TranslationEntry[]) {
  useLocalizationPipelineStore.setState({
    config: VIEW_CONFIG,
    scanResult: {
      totalFilesScanned: 1, totalStringsFound: strings.length, hardcodedCount: strings.length,
      ftextFromStringCount: 0, alreadyLocalizedCount: 0, strings, hazards: [], moduleBreakdown: {},
    },
    strings, hazards: [], entries, qaFindings: [], qaByLocale: {}, isLoading: false, error: null,
    fetchDefaults: async () => {},
  });
}

describe('the shared search box means the same thing on Strings and Translations', () => {
  it('a LOCTEXT-key query that matches a string also matches its translations', () => {
    const other = { ...BASE_STR, id: 'str-2', sourceText: 'Inventory', locKey: 'Inventory' };
    seedView([BASE_STR, other], [entryFor('str-1', 'de'), entryFor('str-1', 'fr'), entryFor('str-2', 'de')]);
    render(<LocalizationPipelineView />);
    fireEvent.click(screen.getByRole('tab', { name: /strings/i }));
    fireEvent.change(screen.getByLabelText(/search strings/i), { target: { value: 'pressstart' } });
    expect(document.body.textContent).toContain('1 strings shown');

    fireEvent.click(screen.getByRole('tab', { name: /translations/i }));
    expect(document.body.textContent).toContain('2 translations shown');
  });
});

describe('the Strings "Missing Translations" preset lists strings that lack a translation', () => {
  it('shows a translatable string missing a target locale, not an already-LOCTEXT string', () => {
    const complete = BASE_STR;
    const partial = { ...BASE_STR, id: 'str-2', sourceText: 'Inventory', locKey: 'Inventory' };
    const localized = { ...BASE_STR, id: 'str-3', sourceText: 'Quit', locKey: 'Quit', currentUsage: 'loctext' as const };
    seedView(
      [complete, partial, localized],
      [entryFor('str-1', 'de'), entryFor('str-1', 'fr'), entryFor('str-2', 'de')],
    );
    render(<LocalizationPipelineView />);
    fireEvent.click(screen.getByRole('tab', { name: /strings/i }));
    fireEvent.click(screen.getByRole('button', { name: /^missing translations$/i }));
    expect(document.body.textContent).toContain('1 strings shown');
    expect(document.body.textContent).toContain('"Inventory"');
    expect(document.body.textContent).not.toContain('"Quit"');
  });
});

describe('the sub-tab strip only points at panels that exist', () => {
  it('every tab aria-controls resolves to an element in the document', () => {
    seedView([BASE_STR], [entryFor('str-1', 'de')]);
    render(<LocalizationPipelineView />);
    const tabs = screen.getAllByRole('tab');
    const dangling = tabs
      .map((t) => t.getAttribute('aria-controls'))
      .filter((id): id is string => !!id && !document.getElementById(id));
    expect(dangling).toEqual([]);
    // The selected tab still names its panel.
    const selected = tabs.find((t) => t.getAttribute('aria-selected') === 'true');
    expect(selected?.getAttribute('aria-controls')).toBe('loc-panel-overview');
  });
});

describe('Overview replacement suggestions are all reachable', () => {
  const many: LOCTEXTReplacementSuggestion[] = Array.from({ length: 12 }, (_, i) => ({
    stringId: `s${i}`, originalCode: `orig${i}`, suggestedCode: `NSLOCTEXT("ns", "k${i}", "t${i}")`,
  }));
  const scan = {
    totalStrings: 12, hardcodedCount: 12, ftextFromStringCount: 0,
    alreadyLocalizedCount: 0, strings: [], hazards: [], moduleBreakdown: {},
  } as unknown as ScanResult;

  it('shows only 10 until expanded, then all 12 suggestedCode strings', () => {
    render(
      <OverviewTab
        scanResult={scan} locReadiness={0} localizedCount={0} totalStrings={12}
        hardcoded={12} ftextCount={0} progress={{}} expansionIssues={{}} qaByLocale={{}}
        replacements={many}
        readiness={{ total: 0, overflow: 0, nearBudget: 0, bypassesCatalog: 0, fragments: 0, fits: 0, reflow: 0, unbudgeted: 0 }}
        scanProvenance={null} onOpenReadiness={() => {}}
      />,
    );
    const reachable = () => many.filter((r) => document.body.textContent?.includes(r.suggestedCode)).length;
    expect(reachable()).toBe(10);
    const btn = Array.from(document.querySelectorAll('button')).find((b) => b.textContent?.includes('Show all'));
    expect(btn).toBeTruthy();
    fireEvent.click(btn as HTMLButtonElement);
    expect(reachable()).toBe(12);
  });
});
