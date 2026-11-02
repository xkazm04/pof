'use client';

/**
 * The lab's GAME view — "where is this game at?" for the ACTIVE game: its manifest pipelines
 * (fit, note, coverage, readiness as separate columns), its planned pipelines ("not built"),
 * the canon rule count for its profiles, the pending pitch-intake count and its engine binding.
 * Every empty state says what is empty; nothing renders as a blank panel or a fake zero.
 */
import { StatusTag } from '@/components/ui/StatusTag';
import { MeterBar } from '@/components/ui/MeterBar';
import { MicroLabel } from '@/components/ui/MicroLabel';
import { LoadingRow } from '@/components/ui/LoadingRow';
import { InlineErrorRetry } from '@/components/modules/shared/InlineErrorRetry';
import type { LabTheme } from '@/components/layout-lab/theme';
import type { EngineState } from '@/lib/games/scope';
import { useGameHomeData, type GameHomeRow, type IntakeRead } from './gameHomeData';
import { GameHomePipelines } from './gameHomePipelines';

/** The engine binding in words + a status level. Exported for tests. */
export function engineWords(e: EngineState): { level: 'ok' | 'warn'; word: string; detail: string } {
  switch (e.kind) {
    case 'undecided': return { level: 'warn', word: 'undecided', detail: 'engine undecided — UE-bound acceptance defers for this game' };
    case 'unbound': return { level: 'warn', word: 'unbound', detail: 'no engine project bound — UE-bound acceptance defers' };
    case 'bound': return { level: 'ok', word: 'bound', detail: e.root };
    case 'project-default': return { level: 'ok', word: 'bound', detail: 'the PoF UE project (POF_UE_ROOT, else the default project), resolved server-side' };
    case 'adapter-missing': return { level: 'warn', word: `${e.engine} ${e.version}`, detail: `engine locked; PoF's engine bridge is UE-only, so engine-bound acceptance defers until a ${e.engine} adapter exists${e.root ? ` (project ${e.root})` : ''}` };
  }
}

function Fact({ label, children, testId }: { label: string; children: React.ReactNode; testId: string }) {
  return (
    <div data-testid={testId} style={{ display: 'grid', gap: 'var(--lab-s1)', minWidth: 160 }}>
      <MicroLabel mono uppercase tone="muted">{label}</MicroLabel>
      <div style={{ fontSize: 'var(--lab-fs-sm)', color: 'var(--lab-ink-deep)' }}>{children}</div>
    </div>
  );
}

function IntakeFact({ intake, onRetry }: { intake: IntakeRead; onRetry: () => void }) {
  if (intake.kind === 'loading') return <LoadingRow variant="inline" label="Reading intake…" />;
  if (intake.kind === 'unavailable') {
    return <InlineErrorRetry dense message={`intake unavailable (${intake.reason})`} onRetry={onRetry} />;
  }
  return <span>{intake.pending === 0 ? 'no proposals pending' : `${intake.pending} pending review`}</span>;
}

/** Declared-target coverage across the rows that DECLARE one; null when none does. */
function declaredCoverage(rows: GameHomeRow[]): { count: number; expected: number } | null {
  const declared = rows.filter((r) => r.fit !== 'planned' && r.registered && r.expected !== undefined);
  if (declared.length === 0) return null;
  return {
    count: declared.reduce((n, r) => n + Math.min(r.count, r.expected ?? 0), 0),
    expected: declared.reduce((n, r) => n + (r.expected ?? 0), 0),
  };
}

export function GameHome({ t }: { t: LabTheme }) {
  const d = useGameHomeData();
  const engine = engineWords(d.engine);
  const built = d.rows.filter((r) => r.fit !== 'planned');
  const planned = d.rows.length - built.length;
  const loading = built.some((r) => r.readiness?.kind === 'loading');
  const coverage = declaredCoverage(d.rows);
  return (
    <section data-testid="game-home" aria-labelledby="game-home-title"
      style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: 'var(--lab-s4) var(--lab-s6)', display: 'grid', alignContent: 'start', gap: 'var(--lab-s4)' }}>
      <header style={{ display: 'grid', gap: 'var(--lab-s1)' }}>
        <MicroLabel mono uppercase tone="muted">Game</MicroLabel>
        <h2 id="game-home-title" style={{ fontFamily: 'var(--lab-font-mono)', fontSize: 'var(--lab-fs-xl)', color: 'var(--lab-ink-deep)' }}>{d.game.title}</h2>
        <span style={{ fontSize: 'var(--lab-fs-xs)', color: t.muted }}>
          {d.game.manifest === 'all'
            ? 'Manifest: every registered pipeline.'
            : `Manifest: ${built.length} built ${built.length === 1 ? 'pipeline' : 'pipelines'}, ${planned} planned.`}
        </span>
      </header>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--lab-s6)' }}>
        <Fact label="Engine" testId="game-home-engine">
          <span title={engine.detail} style={{ display: 'inline-flex', gap: 'var(--lab-s2)', alignItems: 'center', flexWrap: 'wrap' }}>
            <StatusTag level={engine.level} word={engine.word} />
            <span style={{ fontSize: 'var(--lab-fs-xs)', color: t.muted, overflowWrap: 'anywhere' }}>{engine.detail}</span>
          </span>
        </Fact>
        <Fact label="Canon rules" testId="game-home-canon">
          {d.canonRuleCount === 0 ? 'no canon rules yet' : `${d.canonRuleCount} rules across ${d.game.canonProfiles.join(', ')}`}
        </Fact>
        <Fact label="Pitch intake" testId="game-home-intake">
          <IntakeFact intake={d.intake} onRetry={d.retryIntake} />
        </Fact>
        <Fact label="Declared coverage" testId="game-home-coverage">
          {coverage ? (
            <span style={{ display: 'grid', gap: 'var(--lab-s1)', minWidth: 200 }}>
              <MeterBar value={coverage.count} max={coverage.expected} color="var(--lab-ink)" ariaLabel="Declared coverage" valueText={`${coverage.count} of ${coverage.expected}`} />
              <span style={{ fontSize: 'var(--lab-fs-xs)', color: t.muted }}>{coverage.count} of {coverage.expected} declared entities</span>
            </span>
          ) : 'no target declared'}
        </Fact>
      </div>
      {loading && <LoadingRow variant="inline" label="Grading readiness from pipeline artifacts…" />}
      <GameHomePipelines t={t} rows={d.rows} title={d.game.title} onRetry={d.retryArtifacts} />
    </section>
  );
}
