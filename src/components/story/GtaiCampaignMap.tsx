'use client';

/**
 * /story with GTAI active (ticket F-11): the GTAI campaign as `buildCampaignGraph` composes it from
 * the quest packages (`GET /api/games/gtai/story`). Above the Orrery, one column per act: its arc
 * beats (open, realised by a quest, or LOCKED open canon) and the quests placed in it. With no
 * packages the skeleton still renders and says "no contracts yet". The graph is derived on every
 * read and is not a stored graph, so the Walk control does not apply to it.
 */
import { useCallback, useEffect, useState } from 'react';
import { tryApiFetch } from '@/lib/api-utils';
import { LoadingRow } from '@/components/ui/LoadingRow';
import { MicroLabel } from '@/components/ui/MicroLabel';
import { StatusTag } from '@/components/ui/StatusTag';
import { InlineErrorRetry } from '@/components/modules/shared/InlineErrorRetry';
import { OrreryView } from '@/components/story/orrery/OrreryView';
import type { StatusLevel } from '@/lib/status-token';
import type { CampaignActView, CampaignBeatView, CampaignMap } from '@/lib/games/story/campaignMap';

export const GTAI_STORY_URL = '/api/games/gtai/story';

export type CampaignMapPayload = CampaignMap & { hash: string; source: string };

type Load = { kind: 'loading' } | { kind: 'error'; message: string } | { kind: 'ready'; map: CampaignMapPayload };

async function fetchCampaign(): Promise<Load> {
  const r = await tryApiFetch<CampaignMapPayload>(GTAI_STORY_URL);
  if (!r.ok) return { kind: 'error', message: r.error };
  if (!r.data || !Array.isArray(r.data.acts) || !r.data.graph) return { kind: 'error', message: 'unexpected response shape' };
  return { kind: 'ready', map: r.data };
}

const BEAT_TAG: Record<CampaignBeatView['state'], { level: StatusLevel; word: string }> = {
  open: { level: 'warn', word: 'open' },
  claimed: { level: 'ok', word: 'realised' },
  locked: { level: 'bad', word: 'locked' },
};

function Beat({ b }: { b: CampaignBeatView }) {
  const tag = BEAT_TAG[b.state];
  const note = b.state === 'claimed' ? `realised by ${b.claimedBy}` : b.state === 'locked' ? b.lockReason : b.tag === '[proposal]' ? 'host proposal' : 'owner beat';
  return (
    <li data-testid={`campaign-beat-${b.id}`} data-state={b.state} title={note} className="grid gap-0.5">
      <span className="flex flex-wrap items-center gap-1.5">
        <StatusTag level={tag.level} word={tag.word} />
        <span className="text-xs text-text">{b.title}</span>
      </span>
      <MicroLabel tone="muted">{note}</MicroLabel>
    </li>
  );
}

function Act({ a }: { a: CampaignActView }) {
  return (
    <section data-testid={`campaign-act-${a.act}`} className="grid min-w-[180px] flex-1 content-start gap-2 rounded border border-border p-2">
      <MicroLabel mono uppercase tone="muted">{a.title}</MicroLabel>
      <ul className="grid gap-1.5">{a.beats.map((b) => <Beat key={b.id} b={b} />)}</ul>
      {a.quests.length > 0 ? (
        <ul className="grid gap-1" aria-label={`${a.title} contracts`}>
          {a.quests.map((q) => (
            <li key={q.id} data-testid={`campaign-quest-${q.id}`} className="text-xs text-text">
              {q.title}{' '}
              <MicroLabel tone="muted">
                {q.status} · {q.placedOn ? `on ${q.placedOn}` : q.claimsBeat ? `claims ${q.claimsBeat} (not placed)` : 'in act'}
              </MicroLabel>
            </li>
          ))}
        </ul>
      ) : (
        <MicroLabel tone="muted">no contracts in this act</MicroLabel>
      )}
    </section>
  );
}

function Summary({ map }: { map: CampaignMapPayload }) {
  const f = map.findings;
  return (
    <div data-testid="gtai-campaign-summary" className="grid gap-3 px-6 py-3">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-mono text-sm text-text">GTAI campaign</h1>
        <span data-testid="gtai-campaign-count" className="text-xs text-text-muted">
          {map.contractCount === 0 ? 'no contracts yet' : `${map.contractCount} ${map.contractCount === 1 ? 'contract' : 'contracts'}`} · from {map.source}
        </span>
        <StatusTag level={f.errors > 0 ? 'bad' : f.warnings > 0 ? 'warn' : 'ok'} word={`${f.errors} errors · ${f.warnings} warns`} />
        <a href="/story?g=pof" className="focus-ring text-xs text-text-muted underline underline-offset-4 hover:text-text">Stored graphs (PoF)</a>
      </div>
      {map.contractCount === 0 && (
        <p data-testid="gtai-campaign-empty" className="text-xs text-text-muted">
          No contracts yet: this is the campaign skeleton (the acts and arc beats from pitch.md). A quest package
          (games/gtai/quests/&lt;id&gt;/quest.json, written by /gta --quest) appears here on the beat it realises.
        </p>
      )}
      {map.notLoaded.length > 0 && (
        <p data-testid="gtai-campaign-not-loaded" className="text-xs text-text-muted">
          Not on the map (quest.json missing or not gtai.quest/1): {map.notLoaded.join(', ')}
        </p>
      )}
      <div className="flex gap-2 overflow-x-auto">{map.acts.map((a) => <Act key={a.act} a={a} />)}</div>
      <MicroLabel tone="muted">
        Owner-only open canon: {map.protectedVars.join(', ')}. Locked beats: {map.protectedBeats.map((b) => b.id).join(', ') || 'none'}.
      </MicroLabel>
    </div>
  );
}

export function GtaiCampaignMap() {
  const [state, setState] = useState<Load>({ kind: 'loading' });
  useEffect(() => {
    let cancelled = false;
    void fetchCampaign().then((next) => { if (!cancelled) setState(next); });
    return () => { cancelled = true; };
  }, []);
  const retry = useCallback(() => {
    setState({ kind: 'loading' });
    void fetchCampaign().then(setState);
  }, []);

  if (state.kind === 'loading') return <LoadingRow label="Composing the GTAI campaign…" />;
  if (state.kind === 'error') {
    return (
      <div className="mx-auto max-w-2xl p-6">
        <InlineErrorRetry message={`Could not load the GTAI campaign: ${state.message}`} onRetry={retry} />
      </div>
    );
  }
  const { map } = state;
  const dataset = { key: 'gtai-campaign', label: `GTAI campaign · ${map.graph.nodes.length} nodes`, graph: map.graph, hash: map.hash };
  return (
    <div className="flex h-full flex-col">
      <div className="max-h-[45%] shrink-0 overflow-auto"><Summary map={map} /></div>
      <div className="min-h-0 flex-1"><OrreryView datasets={[dataset]} className="h-full" /></div>
    </div>
  );
}
