/**
 * Regression guard for "Migrate severity/status colors to chart-color tokens".
 *
 * LocalizationPipelineView's hazard-severity card colors and translation-status
 * label colors previously came from hand-rolled Tailwind palette classes
 * (bg-amber-500/5, border-blue-500/20, text-red-400, text-emerald-400, …) that
 * drift from the rest of the evaluator across Light / Studio-Dark themes. They
 * now route through SEVERITY_TOKENS (chart-colors) — the same single source the
 * Deep Eval / GDD / game-director severity surfaces use. These tests assert the
 * rendered inline colors equal the token colors so the maps can't silently
 * regress back to bespoke palette classes.
 *
 * jsdom serializes inline hex colors to `rgb(...)` (see reference_jsdom_inline_color_rgb);
 * setup.ts has no afterEach(cleanup) (see reference_test_no_autocleanup).
 */
import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { LocalizationPipelineView } from '@/components/modules/evaluator/LocalizationPipelineView';
import { useLocalizationPipelineStore } from '@/stores/localizationPipelineStore';
import { SEVERITY_TOKENS } from '@/lib/chart-colors';
import type {
  LocalizationHazard,
  TranslationEntry,
  ScanResult,
  LocalizationConfig,
} from '@/types/localization-pipeline';

afterEach(cleanup);

/** jsdom serializes inline hex colors to `rgb(...)`. */
function rgbOf(hex: string): string {
  const h = hex.replace('#', '');
  return `rgb(${parseInt(h.slice(0, 2), 16)}, ${parseInt(h.slice(2, 4), 16)}, ${parseInt(h.slice(4, 6), 16)})`;
}

const HAZARD_CRITICAL: LocalizationHazard = {
  id: 'haz-crit',
  type: 'text_concatenation',
  severity: 'critical',
  description: 'Concatenated user-facing string',
  evidence: '"Level " + n',
  location: { filePath: 'Source/UI/HUD.cpp', lineNumber: 10, columnStart: 1, columnEnd: 5, codeSnippet: 'x' },
  suggestion: 'Use FText::Format',
  fixPrompt: 'fix',
};

const HAZARD_WARNING: LocalizationHazard = {
  id: 'haz-warn',
  type: 'number_format',
  severity: 'warning',
  description: 'Locale-unaware number format',
  evidence: 'sprintf',
  location: { filePath: 'Source/UI/HUD.cpp', lineNumber: 20, columnStart: 1, columnEnd: 5, codeSnippet: 'x' },
  suggestion: 'Use FText::AsNumber',
  fixPrompt: 'fix',
};

function entry(status: TranslationEntry['status'], locale: string): TranslationEntry {
  return {
    stringId: 'str-1',
    locale,
    translatedText: 't',
    status,
    translatorNotes: '',
    backTranslation: 'b',
    confidence: 0.9,
    expansionWarning: false,
    charDelta: 0,
  };
}

const SCAN: ScanResult = {
  totalFilesScanned: 1,
  totalStringsFound: 1,
  hardcodedCount: 1,
  ftextFromStringCount: 0,
  alreadyLocalizedCount: 0,
  strings: [],
  hazards: [HAZARD_CRITICAL, HAZARD_WARNING],
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
    strings: [],
    hazards: [HAZARD_CRITICAL, HAZARD_WARNING],
    // distinct statuses → distinct token colors, no collision with preset-chip labels
    entries: [entry('translated', 'fr'), entry('reviewed', 'de')],
    stringTables: [],
    isLoading: false,
    error: null,
    fetchDefaults: async () => {},
  });
});

describe('LocalizationPipelineView severity/status colors come from SEVERITY_TOKENS', () => {
  it('hazard severity icon colors derive from SEVERITY_TOKENS', () => {
    render(<LocalizationPipelineView />);
    fireEvent.click(screen.getByRole('tab', { name: /hazards/i }));

    const critIcon = screen.getByRole('button', { name: /concatenated user-facing/i }).querySelector('svg');
    const warnIcon = screen.getByRole('button', { name: /locale-unaware number/i }).querySelector('svg');

    expect((critIcon as SVGElement).style.color).toBe(rgbOf(SEVERITY_TOKENS.critical.color));
    expect((warnIcon as SVGElement).style.color).toBe(rgbOf(SEVERITY_TOKENS.warning.color));
  });

  it('translation status label colors derive from SEVERITY_TOKENS', () => {
    render(<LocalizationPipelineView />);
    fireEvent.click(screen.getByRole('tab', { name: /translations/i }));

    // translated → positive (green), reviewed → info (blue)
    expect((screen.getByText('Translated') as HTMLElement).style.color).toBe(rgbOf(SEVERITY_TOKENS.positive.color));
    expect((screen.getByText('Reviewed') as HTMLElement).style.color).toBe(rgbOf(SEVERITY_TOKENS.info.color));
  });
});
