import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Guard: the two legibility rules this repo already believes in are enforced, not
 * merely asserted.
 *
 * Before wave 19 both leaked:
 *
 *  - The size floor lived only in an ESLint `no-restricted-syntax` rule at
 *    **warn** severity, matching only string `Literal` nodes and only 8–11px. It
 *    could not see `text-[6px]` / `text-[7px]` at all, could not see a template
 *    className, and could not see `style={{ fontSize: 9 }}`. `npm run lint` runs a
 *    bare `eslint` with no `--max-warnings`, so 418 accumulated hits failed
 *    nothing. The rule is now complete, but a warning still cannot fail a build —
 *    which is why the hard floor is asserted here instead.
 *  - The contrast rule was *proved* in `src/__tests__/lib/muted-text-contrast.test.ts`
 *    (muted text dimmed to /70 or /60 drops below WCAG AA 1.4.3 on the dark
 *    surface ladder) and then applied to nothing: 161 dimmed call sites shipped.
 *
 * Scope, deliberately: `TEXT_SCALE.meta` (10px, `text-2xs`) is *sanctioned* by
 * `src/lib/typography-scale.ts` for dense metadata, and that file explicitly says
 * existing `text-2xs` uses need no churn — so the ~1,960 of them are not in scope
 * and never will be. Decorative empty-state *icons* dimmed to /30 are non-text
 * (WCAG 1.4.11 applies at 3:1, not 1.4.3 at 4.5:1) and are likewise out of scope —
 * but they are enumerated below and the claim is re-derived from source, not
 * asserted, so the exemption cannot quietly widen to cover real text.
 */

const COMPONENTS = path.join(process.cwd(), 'src', 'components');

/** Below the sanctioned 10px metadata tier — no justification exists for these. */
const SUB_META_SIZE = /text-\[(?:6|7)px\]/g;

/** Muted/subtle text dimmed by an opacity modifier — the AA failure mode. */
const DIMMED_MUTED = /text-text-(?:muted|subtle)\/(?:20|30|40|50|60|70)\b/g;

type HitKind = 'text' | 'icons' | 'docs';

/**
 * The reason-annotated contrast baseline. Counts are split by kind so the *reason*
 * is machine-checkable: the `icons` and `docs` shares are re-derived from source in
 * the second suite, and the `text` share is recorded as the known, shrinking debt
 * it actually is — not as an exemption.
 *
 * Rules this list lives under:
 *   - it may only shrink (totals are ceilings, per file and overall);
 *   - a file that no longer has hits must be deleted from it (stale entries fail);
 *   - a file not listed at all fails immediately, so new debt cannot be added.
 */
const KIND_RATIONALE: Record<HitKind, string> = {
  text: 'KNOWN DEFECT, NOT AN EXEMPTION. Real text dimmed to /50–/70 on a dark surface, '
    + 'which src/__tests__/lib/muted-text-contrast.test.ts proves is below WCAG AA 1.4.3. '
    + 'Each one should become a solid token (text-text-subtle / text-text-muted) or ui/MicroLabel. '
    + 'Wave 19 cleared the /20–/40 tier and the sub-8px tier; this is the remainder, and the '
    + 'ceiling below may only be lowered.',
  icons: 'Out of scope by rule, and the claim is re-derived below: a dimmed decorative glyph is a '
    + 'non-text element, so WCAG 1.4.11 (3:1) governs it rather than 1.4.3 (4.5:1). Each counted '
    + 'occurrence must sit on a line that renders a sized icon element, never a text node.',
  docs: 'Not a call site at all — a comment that names the anti-pattern in prose (e.g. MicroLabel\'s '
    + 'own doc block explaining which hack it replaces). Re-derived below: the line must be a comment.',
};

const CONTRAST_BASELINE: Record<string, Partial<Record<HitKind, number>>> = {
  'blender-mcp/ViewportPreview.tsx': { icons: 2 },
  'cli/TerminalHeader.tsx': { text: 1 },
  'modules/content/animations/AIComboChoreographer/index.tsx': { text: 1 },
  'modules/content/animations/StateMachineEditor/EditorCanvas.tsx': { text: 1 },
  'modules/content/animations/shared/NotifyGlyphs.tsx': { text: 1 },
  'modules/content/level-design/PacingReportPanel.tsx': { icons: 1 },
  'modules/content/materials/MaterialParameterConfigurator/ParametersSection.tsx': { text: 1 },
  'modules/content/materials/MaterialStyleTransfer/AnalysisResults.tsx': { text: 2 },
  'modules/content/materials/MaterialStyleTransfer/index.tsx': { text: 1 },
  'modules/content/ui-hud/HudThemeEditor/LivePreviewScene.tsx': { text: 1 },
  'modules/core-engine/sub_ability/SpellbookSearch.tsx': { text: 1 },
  'modules/core-engine/sub_ability/SpellbookSearchPalette.tsx': { text: 3 },
  'modules/core-engine/sub_ability/blueprint/index.tsx': { icons: 1 },
  'modules/core-engine/sub_animation/budget/MontageAssetBrowser.tsx': { text: 1 },
  'modules/core-engine/sub_animation/budget/StateDurationPanel.tsx': { text: 1 },
  'modules/core-engine/sub_animation/index.tsx': { text: 1 },
  'modules/core-engine/sub_animation/state-graph/StateGroupBrowser.tsx': { text: 3 },
  'modules/core-engine/sub_animation/state-graph/StateMachinePanel.tsx': { text: 2 },
  'modules/core-engine/sub_bestiary/ai-logic/BTFlowchartRow.tsx': { docs: 1 },
  'modules/core-engine/sub_character/ai-feel/FeelInputPanel.tsx': { text: 1 },
  'modules/core-engine/sub_character/index.tsx': { text: 1 },
  'modules/core-engine/sub_character/overview/PropertyColumn.tsx': { text: 1 },
  'modules/core-engine/sub_combat/choreography/GridPanels.tsx': { text: 1 },
  'modules/core-engine/sub_combat/choreography/ScrubTooltip.tsx': { text: 1 },
  'modules/core-engine/sub_combat/choreography/SpatialGrid.tsx': { text: 1, icons: 1 },
  'modules/core-engine/sub_combat/dodge-timeline/FrameDataTable.tsx': { text: 1 },
  'modules/core-engine/sub_combat/dodge-timeline/HitMarkerEditor.tsx': { text: 1 },
  'modules/core-engine/sub_combat/dodge-timeline/ParameterEditor.tsx': { text: 1 },
  'modules/core-engine/sub_combat/dodge-timeline/PhaseLegend.tsx': { text: 1 },
  'modules/core-engine/sub_combat/index.tsx': { text: 1 },
  'modules/core-engine/sub_inventory/catalog/CatalogFiltersBar.tsx': { text: 1 },
  'modules/core-engine/sub_inventory/catalog/ItemComparisonPanel.tsx': { text: 2 },
  'modules/core-engine/sub_inventory/catalog/ItemDetailDrawer.tsx': { text: 1 },
  'modules/core-engine/sub_inventory/dna-genome/BreedingTab.tsx': { icons: 1 },
  'modules/core-engine/sub_inventory/dna-genome/LibraryTab.tsx': { text: 1, icons: 1 },
  'modules/core-engine/sub_inventory/dna-genome/MonteCarloSimulator.tsx': { icons: 1 },
  'modules/core-engine/sub_inventory/dna-genome/RollerTab.tsx': { icons: 1 },
  'modules/core-engine/sub_inventory/dna-genome/SimulatorResults.tsx': { text: 2 },
  'modules/core-engine/sub_inventory/dna-genome/TraitSlider.tsx': { text: 1 },
  'modules/core-engine/sub_inventory/economy-simulator/index.tsx': { icons: 1 },
  'modules/core-engine/sub_inventory/index.tsx': { text: 1 },
  'modules/core-engine/sub_inventory/loot-filter/LivePreview.tsx': { text: 2 },
  'modules/core-engine/sub_inventory/loot-filter/RuleList.tsx': { text: 2 },
  'modules/core-engine/sub_loot/affix-workbench/BreakpointFilters.tsx': { text: 1 },
  'modules/core-engine/sub_loot/index.tsx': { text: 1 },
  'modules/core-engine/unique-tabs/_genome-share/BuildCodeExport.tsx': { text: 1 },
  'modules/core-engine/unique-tabs/_genome-share/GenomeImportPanel.tsx': { text: 3 },
  'modules/core-engine/unique-tabs/_shared/primitives.tsx': { text: 1 },
  'modules/evaluator/ABComparisonPanel.tsx': { text: 5 },
  'modules/evaluator/AntiPatternList.tsx': { text: 2 },
  'modules/evaluator/AssetScoutView/AcquiredAssetsList.tsx': { text: 1, icons: 1 },
  'modules/evaluator/AssetScoutView/AssetRow.tsx': { icons: 1 },
  'modules/evaluator/AssetScoutView/IntegrationView.tsx': { text: 2, icons: 1 },
  'modules/evaluator/AssetScoutView/RecommendationsList.tsx': { text: 1, icons: 1 },
  'modules/evaluator/CombatSimulatorView/DistributionChart.tsx': { text: 1 },
  'modules/evaluator/CombatSimulatorView/FightReportCardPanel.tsx': { text: 1 },
  'modules/evaluator/CombatSimulatorView/ScenarioBuilder.tsx': { text: 2 },
  'modules/evaluator/CombatSimulatorView/ThreatBreakdownPanel.tsx': { text: 2 },
  'modules/evaluator/CombatSimulatorView/index.tsx': { icons: 1 },
  'modules/evaluator/CrashTimeMachine/FrameDetail.tsx': { text: 1 },
  'modules/evaluator/EconomyCodeGenPanel.tsx': { text: 1 },
  'modules/evaluator/EconomyRunsStrip.tsx': { text: 2 },
  'modules/evaluator/EconomySimulatorView/ConfigPanel.tsx': { text: 1 },
  'modules/evaluator/EconomySimulatorView/GoalSeekPanel.tsx': { text: 4 },
  'modules/evaluator/EconomySimulatorView/GoldFlowChart.tsx': { text: 1 },
  'modules/evaluator/EconomySimulatorView/SupplyDemandSection.tsx': { text: 1 },
  'modules/evaluator/EconomySimulatorView/TornadoSection.tsx': { text: 2 },
  'modules/evaluator/EconomySimulatorView/WealthDistributionChart.tsx': { text: 2 },
  'modules/evaluator/EconomySimulatorView/index.tsx': { text: 3, icons: 1 },
  'modules/evaluator/PatternLibraryView/PatternCard.tsx': { text: 3 },
  'modules/evaluator/PerformanceProfilingView/ActorTickTable.tsx': { text: 1 },
  'modules/evaluator/PerformanceProfilingView/CSVImportPanel.tsx': { text: 1 },
  'modules/evaluator/PerformanceProfilingView/index.tsx': { text: 2 },
  'modules/evaluator/PostProcessStudioView/CompareBar.tsx': { text: 1 },
  'modules/evaluator/PostProcessStudioView/ParamSlider.tsx': { text: 1 },
  'modules/evaluator/PostProcessStudioView/PresetGallery.tsx': { text: 1 },
  'modules/evaluator/PromptDiffView.tsx': { text: 1 },
  'modules/evaluator/PromptEvolutionView/ABTestCard.tsx': { text: 1 },
  'modules/evaluator/PromptEvolutionView/EmptyState.tsx': { text: 1, icons: 1 },
  'modules/evaluator/PromptVersionTimeline/EmptyHistory.tsx': { text: 1, icons: 1 },
  'modules/evaluator/PromptVersionTimeline/VersionNode.tsx': { icons: 2 },
  'modules/evaluator/WorkflowOrchestratorView/ActiveWorkflowPanel.tsx': { text: 1 },
  'modules/evaluator/WorkflowOrchestratorView/ExecutionHistoryRow.tsx': { text: 2 },
  'modules/evaluator/WorkflowOrchestratorView/constants.ts': { text: 1 },
  'modules/game-systems/BuildHistoryDashboard/SortableHeader.tsx': { icons: 1 },
  'modules/game-systems/EQSComponentInventory/ComponentCard.tsx': { text: 1 },
  'modules/project-setup/BidirectionalStateSyncPanel/PropertyEditorRow.tsx': { text: 1 },
  'modules/project-setup/BidirectionalStateSyncPanel/SyncLogSection.tsx': { text: 2 },
  'modules/project-setup/BlueprintInspector/index.tsx': { text: 2, icons: 1 },
  'modules/project-setup/BlueprintInspector/primitives.tsx': { text: 1 },
  'modules/project-setup/LiveStateSyncPanel/ActorRow.tsx': { text: 1 },
  'modules/project-setup/LiveStateSyncPanel/PropertyWatchForm.tsx': { text: 1 },
  'modules/project-setup/LiveStateSyncPanel/WatchesSection.tsx': { text: 1 },
  'modules/project-setup/PathBrowser/index.tsx': { icons: 1 },
  'modules/project-setup/ProjectFilesPanel.tsx': { text: 1, icons: 1 },
  // Owned by another lot this wave (RoadmapChecklist) — flagged, not edited here.
  'modules/shared/RoadmapChecklist/ChecklistContextMenu.tsx': { text: 1 },
  'ui/MicroLabel.tsx': { docs: 1 },
};

/* ── scanning ──────────────────────────────────────────────────────────────── */

interface Hit {
  file: string;
  line: number;
  text: string;
  count: number;
  kind: HitKind;
}

function walk(dir: string, acc: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, acc);
    else if (/\.tsx?$/.test(entry.name)) acc.push(full);
  }
  return acc;
}

const isComment = (line: string) => /^(?:\{\/\*|\/\*|\*|\/\/)/.test(line);

/**
 * A dimmed class on a line that renders a *sized* element (`w-4`, `h-6`, …) with a
 * capitalised component tag is an icon, not text. Deliberately narrow: it must see
 * the sizing class, so a plain `<span className="text-text-muted/60">label</span>`
 * can never be waved through as decorative.
 */
const isDecorativeIcon = (line: string) =>
  /<[A-Z][A-Za-z0-9]*\b[^>]*className=["`][^"`]*\bw-\d/.test(line)
  || /className=["`][^"`]*\bw-\d[^"`]*text-text-(?:muted|subtle)\/\d+/.test(line);

function scan(pattern: RegExp): Hit[] {
  const hits: Hit[] = [];
  for (const file of walk(COMPONENTS)) {
    const rel = path.relative(COMPONENTS, file).split(path.sep).join('/');
    fs.readFileSync(file, 'utf8').split(/\r?\n/).forEach((raw, i) => {
      const line = raw.trim();
      const matches = line.match(new RegExp(pattern.source, 'g'));
      if (!matches) return;
      const kind: HitKind = isComment(line) ? 'docs' : isDecorativeIcon(line) ? 'icons' : 'text';
      hits.push({ file: rel, line: i + 1, text: line, count: matches.length, kind });
    });
  }
  return hits;
}

const sizeHits = scan(SUB_META_SIZE);
const contrastHits = scan(DIMMED_MUTED);

const BASELINE_TOTAL = Object.values(CONTRAST_BASELINE)
  .reduce((sum, e) => sum + (e.text ?? 0) + (e.icons ?? 0) + (e.docs ?? 0), 0);

/* ── the floor ─────────────────────────────────────────────────────────────── */

describe('legibility floor: text size', () => {
  it('the scanner reaches the component tree', () => {
    expect(walk(COMPONENTS).length).toBeGreaterThan(500);
  });

  it('no text sits below the sanctioned 10px metadata tier', () => {
    const shown = sizeHits.map((h) => `${h.file}:${h.line} — ${h.text.slice(0, 110)}`);
    expect(
      shown,
      // eslint-disable-next-line no-restricted-syntax -- naming the banned class in the failure message is the point
      'text-[6px] / text-[7px] is below TEXT_SCALE.meta (10px), which is itself the floor\'s only '
      + 'sanctioned exception. Promote to TEXT_SCALE.meta or ui/MicroLabel.\n' + shown.join('\n'),
    ).toEqual([]);
  });
});

/* ── the contrast baseline ─────────────────────────────────────────────────── */

describe('legibility floor: muted-text contrast, shrinking baseline', () => {
  const actual = new Map<string, Record<HitKind, number>>();
  for (const h of contrastHits) {
    const e = actual.get(h.file) ?? { text: 0, icons: 0, docs: 0 };
    e[h.kind] += h.count;
    actual.set(h.file, e);
  }

  it('every dimmed-muted site is accounted for — nothing new may be added', () => {
    const unlisted = [...actual.keys()].filter((f) => !(f in CONTRAST_BASELINE));
    expect(
      unlisted,
      'New dimmed muted-text sites. muted-text-contrast.test.ts proves these fall below WCAG AA on '
      + 'dark surfaces — use a solid token or ui/MicroLabel instead of an opacity modifier:\n'
      + unlisted.join('\n'),
    ).toEqual([]);
  });

  it('no file exceeds its recorded count', () => {
    const grown: string[] = [];
    for (const [file, counts] of actual) {
      const base = CONTRAST_BASELINE[file];
      if (!base) continue;
      for (const kind of ['text', 'icons', 'docs'] as const) {
        const ceiling = base[kind] ?? 0;
        if (counts[kind] > ceiling) grown.push(`${file} (${kind}): ${counts[kind]} > ${ceiling}`);
      }
    }
    expect(grown, `The baseline may only shrink:\n${grown.join('\n')}`).toEqual([]);
  });

  it('has no stale entries — a fixed file must leave the list', () => {
    const stale = Object.keys(CONTRAST_BASELINE).filter((f) => !actual.has(f));
    expect(
      stale,
      `These files are clean now; delete them from CONTRAST_BASELINE so it keeps shrinking:\n${stale.join('\n')}`,
    ).toEqual([]);
  });

  it('the overall total only shrinks', () => {
    const total = contrastHits.reduce((s, h) => s + h.count, 0);
    expect(total).toBeLessThanOrEqual(BASELINE_TOTAL);
  });
});

/* ── re-assert WHY each exemption holds ────────────────────────────────────── */

describe('legibility floor: the baseline reasons are re-derived, not trusted', () => {
  it('every kind carries a substantive rationale', () => {
    for (const [kind, why] of Object.entries(KIND_RATIONALE)) {
      expect(why.length, `${kind} rationale is too thin to be a reason`).toBeGreaterThan(120);
    }
  });

  it('the text share is labelled as debt, not as an accepted exemption', () => {
    // The failure mode this pass exists to prevent: a baseline that reads as
    // "these are fine". They are not fine; they are unfixed.
    expect(KIND_RATIONALE.text).toContain('KNOWN DEFECT');
    expect(KIND_RATIONALE.text).toContain('may only be lowered');
  });

  it('every site counted as a decorative icon really renders a sized icon, not text', () => {
    const claimed = Object.entries(CONTRAST_BASELINE)
      .filter(([, e]) => (e.icons ?? 0) > 0)
      .map(([f]) => f);
    expect(claimed.length, 'the icon exemption should cover a real, non-empty set').toBeGreaterThan(0);

    const bad: string[] = [];
    for (const file of claimed) {
      const derived = contrastHits.filter((h) => h.file === file && h.kind === 'icons')
        .reduce((s, h) => s + h.count, 0);
      const recorded = CONTRAST_BASELINE[file].icons ?? 0;
      if (derived !== recorded) bad.push(`${file}: source shows ${derived} icon sites, baseline claims ${recorded}`);
    }
    expect(
      bad,
      'The icon exemption is only valid for non-text elements. These counts no longer match what the '
      + 'source renders, so the exemption may be covering real text:\n' + bad.join('\n'),
    ).toEqual([]);
  });

  it('every site counted as documentation really is a comment', () => {
    const claimed = Object.entries(CONTRAST_BASELINE)
      .filter(([, e]) => (e.docs ?? 0) > 0)
      .map(([f]) => f);
    for (const file of claimed) {
      const lines = contrastHits.filter((h) => h.file === file && h.kind === 'docs');
      expect(lines.length, `${file} claims a documentation exemption but has no comment hit`).toBeGreaterThan(0);
      for (const h of lines) {
        expect(isComment(h.text), `${file}:${h.line} is not a comment`).toBe(true);
      }
    }
  });
});
