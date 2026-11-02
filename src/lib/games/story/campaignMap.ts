/**
 * The GTAI story map (ticket F-11): the campaign graph `buildCampaignGraph` emits (`pof.storygraph/1`,
 * project `gtai`, graph `gtai-campaign`) plus a per-act reading of it for the /story page: every arc
 * beat with its state (open, locked open canon, or realised by a quest), and every quest package
 * placed on the beat it realises or, when it realises none, in its act. Pure: the route supplies the
 * ledger (`loadLedger`). The guard logic is only imported, never changed here.
 *
 * "Claimed" is read back from the GRAPH, not re-derived: a claimed beat leaves the node chain and its
 * variables' writer becomes the quest node, so the map and the graph cannot disagree.
 */
import { validateStoryGraph } from '@/lib/story/validate';
import type { StoryGraph } from '@/lib/story/types';
import { GTAI_ARC, PROTECTED_VAR_NAMES } from '@/lib/games/gtai-quest/campaignBaseline';
import { OPEN_CANON_BEATS, buildCampaignGraph } from '@/lib/games/gtai-quest/storyGuard';
import type { ActId, QuestPackage, QuestStatus } from '@/lib/games/gtai-quest/types';

export type CampaignBeatState = 'open' | 'locked' | 'claimed';

export interface CampaignBeatView {
  id: string;
  title: string;
  tag: '[owner]' | '[proposal]';
  state: CampaignBeatState;
  writes: readonly string[];
  /** The quest id that realises the beat (`state: 'claimed'`). */
  claimedBy?: string;
  /** Why the beat is locked (`state: 'locked'`). */
  lockReason?: string;
}

export interface CampaignQuestView {
  id: string;
  title: string;
  act: ActId;
  status: QuestStatus;
  logline: string;
  /** The beat the package declares it realises, as written. */
  claimsBeat?: string;
  /** The beat it is placed on in the graph; null = in its act, realising no beat (or the claim was refused). */
  placedOn: string | null;
}

export interface CampaignActView {
  act: ActId;
  title: string;
  beats: CampaignBeatView[];
  quests: CampaignQuestView[];
}

export interface CampaignMap {
  gameId: 'gtai';
  graph: StoryGraph;
  acts: CampaignActView[];
  /** Quest packages placed on the map. 0 = the campaign skeleton only ("no contracts yet"). */
  contractCount: number;
  /** Quest folders whose `quest.json` is missing or is not a `gtai.quest/1` package: listed, not hidden. */
  notLoaded: string[];
  /** Owner-only open canon: the variables no quest may write and the beats no quest may realise. */
  protectedVars: string[];
  protectedBeats: { id: string; act: ActId; title: string; reason: string }[];
  /** The structural validator over the composed graph. */
  findings: { errors: number; warnings: number; codes: string[] };
}

const LOCK_REASON = 'open canon: realising it would decide who betrays Rivet or what the fourth soul is; owner-only until decided';

/** The quest node id that writes `variable` in the graph, or null. */
function writerQuestOf(graph: StoryGraph, variable: string | undefined): string | null {
  if (!variable) return null;
  const w = graph.variables.find((v) => v.name === variable)?.writers.find((id) => id.startsWith('quest.'));
  return w ? w.slice('quest.'.length) : null;
}

export function campaignMapOf(ledger: readonly QuestPackage[], notLoaded: readonly string[] = []): CampaignMap {
  const graph = buildCampaignGraph([...ledger]);
  const nodeIds = new Set(graph.nodes.map((n) => n.id));
  const placed = new Map<string, string>(); // questId -> beatId

  const acts = GTAI_ARC.map((arc): CampaignActView => {
    const beats = arc.beats.map((b): CampaignBeatView => {
      const base = { id: b.id, title: b.title, tag: b.tag, writes: b.writes };
      if (OPEN_CANON_BEATS.includes(b.id)) return { ...base, state: 'locked', lockReason: LOCK_REASON };
      const claimant = nodeIds.has(b.id) ? null : writerQuestOf(graph, b.writes[0]);
      if (claimant) {
        placed.set(claimant, b.id);
        return { ...base, state: 'claimed', claimedBy: claimant };
      }
      return { ...base, state: 'open' };
    });
    const quests = ledger
      .filter((q) => q.act === arc.act)
      .map((q): CampaignQuestView => ({
        id: q.id, title: q.title, act: q.act, status: q.status, logline: q.logline,
        ...(q.claimsBeat ? { claimsBeat: q.claimsBeat } : {}),
        placedOn: placed.get(q.id) ?? null,
      }))
      .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    return { act: arc.act, title: arc.title, beats, quests };
  });

  const findings = validateStoryGraph(graph);
  return {
    gameId: 'gtai',
    graph,
    acts,
    contractCount: ledger.length,
    notLoaded: [...notLoaded],
    protectedVars: [...PROTECTED_VAR_NAMES],
    protectedBeats: acts.flatMap((a) => a.beats.filter((b) => b.state === 'locked').map((b) => ({ id: b.id, act: a.act, title: b.title, reason: LOCK_REASON }))),
    findings: {
      errors: findings.filter((f) => f.severity === 'error').length,
      warnings: findings.filter((f) => f.severity === 'warn').length,
      codes: [...new Set(findings.filter((f) => f.severity === 'error' || f.severity === 'warn').map((f) => f.code))].sort(),
    },
  };
}
