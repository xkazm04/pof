import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  HUD_THEME_PARAMS,
  themeDefaults,
  sectionParams,
  exportStats,
  formatExportLine,
  formatCategoryLine,
  cppFixedFloat,
} from '@/components/modules/content/ui-hud/HudThemeEditor/themeSchema';
import { generateUE5Config, parseUE5Config } from '@/components/modules/content/ui-hud/HudThemeEditor/helpers';
import { DEFAULT_THEME } from '@/components/modules/content/ui-hud/HudThemeEditor/constants';
import type { HudTheme } from '@/components/modules/content/ui-hud/HudThemeEditor/types';

/**
 * One HUD theme parameter table. Each of the 20 UE UPROPERTYs the HUD Theme Editor
 * tunes is declared once in HUD_THEME_PARAMS; defaults, sliders, the .h export, the
 * export stats and the .h import are projections of that table.
 */

const FIXTURE = path.join(process.cwd(), 'src', '__tests__', 'components', 'ui-hud', '__fixtures__', 'hudThemeExport.base.h');

/** The literal defaults as hand-written in constants.ts before the table existed. */
const BASE_DEFAULT_THEME: HudTheme = {
  healthyColor:       { r: 0.1, g: 0.8, b: 0.1, a: 1.0 },
  dangerColor:        { r: 0.9, g: 0.1, b: 0.1, a: 1.0 },
  manaColor:          { r: 0.2, g: 0.3, b: 1.0, a: 1.0 },
  lowHealthThreshold: 0.25,
  lowHealthPulseSpeed: 2.0,
  barInterpSpeed:     10.0,
  elementColors: {
    Physical:  { r: 1.0, g: 1.0, b: 1.0, a: 1.0 },
    Fire:      { r: 1.0, g: 0.3, b: 0.1, a: 1.0 },
    Ice:       { r: 0.3, g: 0.6, b: 1.0, a: 1.0 },
    Lightning: { r: 1.0, g: 1.0, b: 0.2, a: 1.0 },
    Heal:      { r: 0.2, g: 1.0, b: 0.3, a: 1.0 },
  },
  normalFontSize:    18,
  critFontSize:      26,
  floatDistance:     80,
  horizontalSpread:  30,
  damageLifetime:    1.0,
  fadeInDuration:    0.2,
  fadeOutDuration:   0.5,
  fadeOutDelay:      3.0,
  enemyBarColor:     { r: 0.8, g: 0.1, b: 0.1, a: 1.0 },
};

const EXPORT_ORDER = [
  'HealthBarColor', 'LowHealthColor', 'LowHealthThreshold', 'LowHealthPulseSpeed',
  'ManaBarColor',
  'BarColor', 'BarInterpSpeed', 'FadeInDuration', 'FadeOutDuration', 'FadeOutDelay',
  'PhysicalColor', 'FireColor', 'IceColor', 'LightningColor', 'HealColor',
  'NormalFontSize', 'CritFontSize', 'FloatDistance', 'HorizontalSpread', 'DamageLifetime',
];

/** A valid C++ floating literal with an `f` suffix: needs a `.` or an exponent before the suffix. */
const CPP_FLOAT_LITERAL = /^-?(?:\d+\.\d*|\.\d+|\d+(?:\.\d*)?[eE][-+]?\d+)f$/;

describe('HUD_THEME_PARAMS — one row per UPROPERTY', () => {
  it('has 20 rows with unique ueName, in export order; every HudTheme key maps to exactly one row', () => {
    expect(HUD_THEME_PARAMS).toHaveLength(20);
    const names = HUD_THEME_PARAMS.map(p => p.ueName);
    expect(new Set(names).size).toBe(20);
    expect(names).toEqual(EXPORT_ORDER);

    for (const key of Object.keys(BASE_DEFAULT_THEME) as (keyof HudTheme)[]) {
      if (key === 'elementColors') continue;
      expect(HUD_THEME_PARAMS.filter(p => p.key === key), key).toHaveLength(1);
    }
    expect(HUD_THEME_PARAMS.filter(p => p.key === 'barInterpSpeed')).toHaveLength(1);
    const elements = HUD_THEME_PARAMS.filter(p => p.key === 'elementColors').map(p => p.kind === 'color' && p.element);
    expect(elements).toEqual(['Physical', 'Fire', 'Ice', 'Lightning', 'Heal']);
  });
});

describe('themeDefaults', () => {
  it('deep-equals the base literal DEFAULT_THEME, and constants.ts DEFAULT_THEME is the derived value', () => {
    expect(themeDefaults()).toEqual(BASE_DEFAULT_THEME);
    expect(DEFAULT_THEME).toEqual(themeDefaults());
    const constantsSrc = fs.readFileSync(
      path.join(process.cwd(), 'src', 'components', 'modules', 'content', 'ui-hud', 'HudThemeEditor', 'constants.ts'),
      'utf8',
    );
    expect(constantsSrc).toMatch(/DEFAULT_THEME\s*:\s*HudTheme\s*=\s*themeDefaults\(\)/);
  });
});

describe('generateUE5Config', () => {
  it('[guard] DEFAULT_THEME export is byte-identical to the base fixture', () => {
    const fixture = fs.readFileSync(FIXTURE, 'utf8').replace(/\r\n/g, '\n');
    expect(generateUE5Config(DEFAULT_THEME)).toBe(fixture);
  });

  it('every emitted number is a valid C++ float literal, including integral and non-finite values', () => {
    const odd: HudTheme = {
      ...structuredClone(DEFAULT_THEME),
      fadeOutDelay: 4, barInterpSpeed: 12, lowHealthThreshold: 0.5, normalFontSize: 18.6,
      damageLifetime: Number.NaN,
      elementColors: { ...DEFAULT_THEME.elementColors, Fire: { r: 1, g: 0, b: 0, a: 1 } },
    };
    const literals = generateUE5Config(odd).match(/-?[\d.]+(?:[eE][-+]?\d+)?f\b|NaNf|Infinityf/g) ?? [];
    expect(literals.length).toBeGreaterThanOrEqual(20);
    for (const lit of literals) expect(lit).toMatch(CPP_FLOAT_LITERAL);
    expect(cppFixedFloat(4, 1)).toBe('4.0f');
    expect(cppFixedFloat(18, 0)).toBe('18.0f');
    expect(cppFixedFloat(Number.NaN, 2)).toBe('0.f');
  });

  it('formatExportLine / formatCategoryLine render one row the way the export does', () => {
    const fade = HUD_THEME_PARAMS.find(p => p.ueName === 'FadeOutDelay')!;
    expect(formatCategoryLine(fade)).toBe('UPROPERTY(EditAnywhere, Category = "EnemyHP|Fade")');
    expect(formatExportLine(fade, { ...DEFAULT_THEME, fadeOutDelay: 4.5 })).toBe('float FadeOutDelay = 4.5f;');
    expect(fade.widget).toBe('EnemyHealthBarWidget');
  });
});

describe('exportStats', () => {
  it('counts what the export really contains', () => {
    expect(exportStats(DEFAULT_THEME)).toEqual({ uproperties: 20, widgetClasses: 3, elements: 5 });
  });
});

describe('parseUE5Config — the .h import', () => {
  it('round-trips a tuned theme through the export', () => {
    const T: HudTheme = {
      ...structuredClone(DEFAULT_THEME),
      fadeOutDelay: 4.5,
      critFontSize: 30,
      lowHealthThreshold: 0.4,
      elementColors: { ...structuredClone(DEFAULT_THEME.elementColors), Fire: { r: 0.5, g: 0.25, b: 0, a: 1 } },
    };
    expect(parseUE5Config(generateUE5Config(T), DEFAULT_THEME)).toEqual({
      theme: T, applied: EXPORT_ORDER, unknown: [], warnings: [], malformed: [],
    });
  });

  it('reports an unknown UPROPERTY name instead of dropping it', () => {
    const r = parseUE5Config('float FadeOutDelay = 4.5f;\nfloat Bogus = 1.0f;', DEFAULT_THEME);
    expect(r.theme).toEqual({ ...DEFAULT_THEME, fadeOutDelay: 4.5 });
    expect(r.applied).toEqual(['FadeOutDelay']);
    expect(r.unknown).toEqual(['Bogus']);
    expect(r.malformed).toEqual([]);
  });

  it('clamps to the schema range with a warning', () => {
    const r = parseUE5Config('float LowHealthThreshold = 0.95f;', DEFAULT_THEME);
    expect(r.theme.lowHealthThreshold).toBe(0.75);
    expect(r.warnings).toEqual([{ name: 'LowHealthThreshold', clampedFrom: 0.95 }]);
  });

  it('flags malformed and kind-mismatched lines with their line number, never silently', () => {
    const r = parseUE5Config(
      [
        '// a comment',
        'UPROPERTY(EditAnywhere, Category = "EnemyHP|Fade")',
        'float FadeOutDelay = abc;',
        'int32 CritFontSize = 30;',
        'float HealthBarColor = 1.0f;',
        'float FadeInDuration = 0.3f;',
      ].join('\n'),
      DEFAULT_THEME,
    );
    expect(r.applied).toEqual(['FadeInDuration']);
    expect(r.theme).toEqual({ ...DEFAULT_THEME, fadeInDuration: 0.3 });
    expect(r.malformed.map(m => m.line)).toEqual([3, 4, 5]);
    expect(r.malformed[2].reason).toMatch(/color/i);
  });
});

describe('sectionParams', () => {
  it('drives the slider sections; BarInterpSpeed lives only in the enemy section', () => {
    expect(sectionParams('enemy').map(p => p.ueName)).toEqual([
      'BarColor', 'BarInterpSpeed', 'FadeInDuration', 'FadeOutDuration', 'FadeOutDelay',
    ]);
    expect(sectionParams('health').map(p => p.ueName)).not.toContain('BarInterpSpeed');
  });
});

describe('ExportPanel — derived stats and the paste-.h import', () => {
  it('shows the counted stats and imports a pasted .h, naming every line it did not apply', async () => {
    const { render, screen, fireEvent, cleanup } = await import('@testing-library/react');
    const { createElement } = await import('react');
    const { ExportPanel } = await import('@/components/modules/content/ui-hud/HudThemeEditor/ExportPanel');
    const imported: HudTheme[] = [];
    render(createElement(ExportPanel, {
      theme: DEFAULT_THEME,
      exportConfig: generateUE5Config(DEFAULT_THEME),
      copied: false,
      handleCopy: () => {},
      handleDownload: () => {},
      onImport: (t: HudTheme) => { imported.push(t); },
    }));
    const stats = screen.getByTestId('hud-theme-export-stats').textContent;
    expect(stats).toBe('20UPROPERTYs3Widget Classes5Elements');

    fireEvent.click(screen.getByRole('button', { name: /paste \.h/i }));
    fireEvent.change(screen.getByLabelText('Paste a HUD theme .h'), {
      target: { value: 'float FadeOutDelay = 4.5f;\nfloat Bogus = 1.0f;\nint32 X = 1;' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Import' }));
    expect(imported).toHaveLength(1);
    expect(imported[0].fadeOutDelay).toBe(4.5);
    const report = screen.getByTestId('hud-theme-import-report').textContent ?? '';
    expect(report).toContain('Applied 1 UPROPERTY');
    expect(report).toContain('Bogus');
    expect(report).toContain('Line 3');

    fireEvent.change(screen.getByLabelText('Paste a HUD theme .h'), { target: { value: 'nonsense' } });
    fireEvent.click(screen.getByRole('button', { name: 'Import' }));
    expect(imported).toHaveLength(1);
    expect(screen.getByTestId('hud-theme-import-report').textContent).toContain('Nothing applied');
    cleanup();
  });
});

describe('ParameterEditor — one control per UPROPERTY', () => {
  it('renders BarInterpSpeed once (enemy section) and moving a slider writes through the row', async () => {
    const { render, screen, fireEvent, cleanup } = await import('@testing-library/react');
    const { createElement } = await import('react');
    const { ParameterEditor } = await import('@/components/modules/content/ui-hud/HudThemeEditor/ParameterEditor');
    const writes: Array<[string, unknown]> = [];
    const props = (section: 'health' | 'damage' | 'enemy') => ({
      theme: DEFAULT_THEME,
      setParam: (p: { ueName: string }, v: unknown) => { writes.push([p.ueName, v]); },
      activeSection: section,
      setActiveSection: () => {},
      sections: [
        { id: 'health' as const, label: 'Health & Mana', color: 'var(--text)' },
        { id: 'damage' as const, label: 'Damage Numbers', color: 'var(--text)' },
        { id: 'enemy' as const, label: 'Enemy HP Bar', color: 'var(--text)' },
      ],
    });
    const { rerender } = render(createElement(ParameterEditor, props('health')));
    expect(screen.queryAllByText('BarInterpSpeed')).toHaveLength(0);
    const threshold = screen.getAllByRole('slider')[0] as HTMLInputElement;
    expect(threshold.value).toBe('25');
    fireEvent.change(threshold, { target: { value: '40' } });
    expect(writes.at(-1)).toEqual(['LowHealthThreshold', 0.4]);

    rerender(createElement(ParameterEditor, props('enemy')));
    expect(screen.getAllByText('BarInterpSpeed')).toHaveLength(1);
    cleanup();
  });
});
