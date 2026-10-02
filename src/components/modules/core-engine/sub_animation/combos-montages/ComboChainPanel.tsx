'use client';

import { useState } from 'react';
import { STATUS_SUCCESS, STATUS_WARNING } from '@/lib/chart-colors';
import { BlueprintPanel, SectionHeader } from '../../unique-tabs/_design';
import { ACCENT } from '../_shared/data';
import { ComboChainGraphSvg } from './ComboChainGraphSvg';
import { ComboLinkDetail } from './ComboLinkDetail';
import type { ComboChainsView } from './useComboChains';

interface ComboChainPanelProps {
  view: ComboChainsView;
  selectedNodeId?: string | null;
  onSelectNode?: (id: string | null) => void;
}

/**
 * Combo Chain Graph. In bridge mode every link is the project's own, drawn with
 * a derived verdict (lib/animation/combo-links); a selected link opens its
 * detail and, when defective, 'Fix in UE'. Without a usable manifest it draws
 * the fixture chain, labelled TEMPLATE, with no verdicts.
 */
export function ComboChainPanel({ view, selectedNodeId, onSelectNode }: ComboChainPanelProps) {
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const selectedLink = view.source === 'bridge'
    ? view.graphs.flatMap((g) => g.edges).find((e) => e.id === selectedEdgeId)?.link
    : undefined;

  return (
    <BlueprintPanel color={ACCENT} className="p-4">
      <SectionHeader label="Combo Chain Graph" color={ACCENT} />
      <ChainSource view={view} />

      <div className="space-y-3">
        {view.graphs.map((graph) => (
          <div key={graph.id}>
            {view.source === 'bridge' && (
              <div className="text-xs font-mono font-bold text-text-muted mb-1">{graph.title}</div>
            )}
            <div className="flex justify-center overflow-x-auto">
              <ComboChainGraphSvg
                graph={graph}
                selectedNodeId={selectedNodeId}
                onSelectNode={onSelectNode}
                selectedEdgeId={selectedEdgeId}
                onSelectEdge={setSelectedEdgeId}
              />
            </div>
          </div>
        ))}
      </div>

      {selectedLink && <ComboLinkDetail link={selectedLink} onClose={() => setSelectedEdgeId(null)} />}
    </BlueprintPanel>
  );
}

/** Provenance: whose chain this is, and what each verdict was derived from. */
function ChainSource({ view }: { view: ComboChainsView }) {
  if (view.source === 'template') {
    return (
      <p data-testid="combo-chain-source" data-source="template" className="text-xs font-mono text-text-muted mt-1 mb-3 leading-relaxed">
        <span className="font-bold" style={{ color: STATUS_WARNING }}>TEMPLATE — example chain, not your project</span>
        {' '}({view.reason}). Windows and damage below are fixture values; no link is checked.
      </p>
    );
  }
  const links = view.graphs.reduce((n, g) => n + g.edges.length, 0);
  return (
    <p data-testid="combo-chain-source" data-source="bridge" className="text-xs font-mono text-text-muted mt-1 mb-3 leading-relaxed">
      <span className="font-bold" style={{ color: STATUS_SUCCESS }}>SOURCE: PoF bridge manifest</span>
      {view.projectName ? <> ({view.projectName})</> : null} — {view.graphs.length} chain{view.graphs.length === 1 ? '' : 's'},
      {' '}{links} link{links === 1 ? '' : 's'} from {view.montages} montage{view.montages === 1 ? '' : 's'}.
      {' '}A window opens at the first combo/cancel notify and closes at the montage end; target {view.targetSec.toFixed(2)}s
      {' '}(declared combo window). Click a link for its basis.
      {view.byOrder && <> Section windows attributed by order — the manifest carries no section times.</>}
      {view.skipped.length > 0 && (
        <> Not checked (no duration): {view.skipped.map((s) => s.name).join(', ')}.</>
      )}
    </p>
  );
}
