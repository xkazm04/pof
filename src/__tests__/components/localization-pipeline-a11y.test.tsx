/**
 * Regression guard for "Make expandable cards and filters keyboard-accessible".
 *
 * LocalizationPipelineView previously expanded its StringCard / HazardCard /
 * StringTableCard via `<div onClick>` (not focusable / not operable by keyboard),
 * its SubTab nav lacked tab semantics, and the search / select filters had no
 * accessible name. These tests assert the fixed semantics:
 *   - card headers are <button aria-expanded> wired to their panel via aria-controls
 *   - the sub-tab nav is a role=tablist of role=tab buttons with aria-selected
 *   - every filter control has an associated <label> (queryable by accessible name)
 *
 * setup.ts has no afterEach(cleanup) — see reference_test_no_autocleanup.
 */
import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react';
import { LocalizationPipelineView } from '@/components/modules/evaluator/LocalizationPipelineView';
import { useLocalizationPipelineStore } from '@/stores/localizationPipelineStore';
import type {
  LocalizableString,
  LocalizationHazard,
  StringTable,
  TranslationEntry,
  ScanResult,
  LocalizationConfig,
} from '@/types/localization-pipeline';

afterEach(cleanup);

const STRING: LocalizableString = {
  id: 'str-1',
  sourceText: 'Press Start',
  context: 'ui_button',
  currentUsage: 'hardcoded',
  locNamespace: 'UI',
  locKey: 'PressStart',
  locations: [{ filePath: 'Source/UI/Menu.cpp', lineNumber: 42, columnStart: 1, columnEnd: 10, codeSnippet: 'Text("Press Start")' }],
  sourceModule: 'arpg-ui',
  detectionConfidence: 0.95,
};

const HAZARD: LocalizationHazard = {
  id: 'haz-1',
  type: 'text_concatenation',
  severity: 'critical',
  description: 'Concatenated user-facing string',
  evidence: '"Level " + n',
  location: { filePath: 'Source/UI/HUD.cpp', lineNumber: 10, columnStart: 1, columnEnd: 5, codeSnippet: 'FString("Level ") + n' },
  suggestion: 'Use FText::Format with named arguments',
  fixPrompt: 'Replace string concatenation with FText::Format',
};

const TABLE: StringTable = {
  tableId: 'ST_Items',
  namespace: 'Items',
  rows: [{ key: 'Sword', sourceString: 'Sword', comment: 'weapon name' }],
};

const ENTRY: TranslationEntry = {
  stringId: 'str-1',
  locale: 'fr',
  translatedText: 'Commencer',
  status: 'translated',
  translatorNotes: '',
  backTranslation: 'Start',
  confidence: 0.9,
  expansionWarning: false,
  charDelta: 2,
};

const SCAN: ScanResult = {
  totalFilesScanned: 1,
  totalStringsFound: 1,
  hardcodedCount: 1,
  ftextFromStringCount: 0,
  alreadyLocalizedCount: 0,
  strings: [STRING],
  hazards: [HAZARD],
  moduleBreakdown: { 'arpg-ui': { total: 1, hardcoded: 1, localized: 0 } },
};

const CONFIG: LocalizationConfig = {
  rootNamespace: 'PoF',
  targetLocales: ['fr', 'de'],
  scanModules: ['arpg-ui'],
  glossary: [],
  autoApplyThreshold: 0.8,
};

beforeEach(() => {
  useLocalizationPipelineStore.setState({
    config: CONFIG,
    scanResult: SCAN,
    strings: [STRING],
    hazards: [HAZARD],
    entries: [ENTRY],
    stringTables: [TABLE],
    isLoading: false,
    error: null,
    // Neutralise the on-mount defaults fetch so the test makes no network calls.
    fetchDefaults: async () => {},
  });
});

describe('LocalizationPipelineView is keyboard / screen-reader accessible', () => {
  it('renders the sub-tab nav as a tablist of tabs with aria-selected', () => {
    render(<LocalizationPipelineView />);
    const tablist = screen.getByRole('tablist', { name: /localization views/i });
    expect(within(tablist).getAllByRole('tab')).toHaveLength(6);

    const overview = screen.getByRole('tab', { name: /overview/i });
    const strings = screen.getByRole('tab', { name: /strings/i });
    expect(overview.getAttribute('aria-selected')).toBe('true');
    expect(strings.getAttribute('aria-selected')).toBe('false');

    fireEvent.click(strings);
    expect(strings.getAttribute('aria-selected')).toBe('true');
    expect(overview.getAttribute('aria-selected')).toBe('false');
  });

  it('StringCard header is a button that toggles aria-expanded and reveals its panel', () => {
    render(<LocalizationPipelineView />);
    fireEvent.click(screen.getByRole('tab', { name: /strings/i }));

    const toggle = screen.getByRole('button', { name: /press start/i });
    expect(toggle.tagName).toBe('BUTTON');
    expect(toggle.getAttribute('aria-expanded')).toBe('false');

    const panelId = toggle.getAttribute('aria-controls');
    expect(panelId).toBeTruthy();
    expect(document.getElementById(panelId!)).toBeNull();

    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(document.getElementById(panelId!)).not.toBeNull();
  });

  it('HazardCard header is a button that toggles aria-expanded', () => {
    render(<LocalizationPipelineView />);
    fireEvent.click(screen.getByRole('tab', { name: /hazards/i }));

    const toggle = screen.getByRole('button', { name: /concatenated user-facing/i });
    expect(toggle.tagName).toBe('BUTTON');
    expect(toggle.getAttribute('aria-expanded')).toBe('false');

    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    // The fix-prompt action only exists once the panel is open.
    expect(screen.getByRole('button', { name: /copy fix prompt/i })).toBeTruthy();
  });

  it('StringTableCard header is a button with the Copy CSV control as a sibling (no nested buttons)', () => {
    render(<LocalizationPipelineView />);
    fireEvent.click(screen.getByRole('tab', { name: /string tables/i }));

    const toggle = screen.getByRole('button', { name: /ST_Items/i });
    const copy = screen.getByRole('button', { name: /copy csv/i });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    // Copy CSV must NOT be nested inside the toggle button (invalid + inoperable).
    expect(toggle.contains(copy)).toBe(false);

    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
  });

  it('Strings-tab filters have associated accessible labels', () => {
    render(<LocalizationPipelineView />);
    fireEvent.click(screen.getByRole('tab', { name: /strings/i }));

    expect(screen.getByLabelText(/search strings/i).tagName).toBe('INPUT');
    expect(screen.getByLabelText(/filter strings by context/i).tagName).toBe('SELECT');
  });

  it('Translations-tab filters have associated accessible labels', () => {
    render(<LocalizationPipelineView />);
    fireEvent.click(screen.getByRole('tab', { name: /translations/i }));

    expect(screen.getByLabelText(/search translations by source text/i).tagName).toBe('INPUT');
    expect(screen.getByLabelText(/filter translations by locale/i).tagName).toBe('SELECT');
  });
});
