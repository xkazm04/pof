'use client';

/**
 * Orrery — the composed story-map surface.
 *
 * This is the seam between the three packages: `OrreryChrome` (topbar, breadcrumbs, honesty
 * badges, legend, tools, search), `OrreryStage` (the wheel) and `OrreryPanel` (the inspector and
 * the nested detail layer). It owns the application state they share and nothing else; every piece
 * of geometry lives behind the stage's camera, and every derived fact lives in the model.
 *
 * Ported from the winning prototype of the `storymap` design contest (variant A/3, "Orrery"),
 * chosen by the owner for its compactness and the smoothness of its navigation. Two themes ship:
 * `orrery` is a faithful translation of the winner, `blueprint` re-themes it into PoF's house
 * surface. They differ in hue and surface only — every structural value is shared.
 */

import { useCallback, useMemo, useRef, useState } from 'react';

import { OrreryChrome } from './OrreryChrome';
import { OrreryPanel } from './OrreryPanel';
import { OrreryStage, type OrreryStageControls } from './OrreryStage';
import './themes/orrery.css';
import './themes/blueprint.css';

import { buildOrreryModel, type LineDetail, type NodeIx } from '@/lib/story/orrery';
import type { StoryGraph } from '@/lib/story/types';

export type OrreryTheme = 'orrery' | 'blueprint';

export interface OrreryLayerToggles {
  impact: boolean;
  paths: boolean;
  influence: boolean;
  flags: boolean;
}

export interface OrreryDataset {
  key: string;
  label: string;
  graph: StoryGraph;
}

export interface OrreryViewProps {
  datasets: OrreryDataset[];
  /** Which dataset to show. Uncontrolled when omitted. */
  activeKey?: string;
  onActiveKeyChange?: (key: string) => void;
  theme?: OrreryTheme;
  className?: string;
}

const DEFAULT_LAYERS: OrreryLayerToggles = {
  impact: true,
  paths: true,
  influence: true,
  flags: true,
};

export function OrreryView({
  datasets,
  activeKey,
  onActiveKeyChange,
  theme = 'orrery',
  className,
}: OrreryViewProps) {
  const [ownKey, setOwnKey] = useState(() => datasets[0]?.key ?? '');
  const key = activeKey ?? ownKey;

  const [focus, setFocus] = useState<NodeIx>(-1);
  const [selected, setSelected] = useState<NodeIx>(-1);
  const [detail, setDetail] = useState<LineDetail | null>(null);
  const [tab, setTab] = useState<'inspect' | 'audit'>('inspect');
  const [lens, setLens] = useState<string | null>(null);
  const [show, setShow] = useState<OrreryLayerToggles>(DEFAULT_LAYERS);
  const [help, setHelp] = useState(false);

  // The camera lives in the stage, so the chrome's zoom and fit buttons are wired through the
  // handshake the stage offers rather than by a second copy of the transform. Without this the
  // buttons render disabled, which is honest but useless.
  const controls = useRef<OrreryStageControls | null>(null);

  const dataset = useMemo(
    () => datasets.find((d) => d.key === key) ?? datasets[0],
    [datasets, key],
  );

  // The model is a pure function of the document, so it is memoised on the document alone. It is
  // the single authority for every derived fact on this surface; nothing below recomputes one.
  const model = useMemo(
    () => (dataset ? buildOrreryModel(dataset.graph, dataset.key) : null),
    [dataset],
  );

  const chooseDataset = useCallback(
    (next: string) => {
      // A new document invalidates every index, so the whole selection resets with it.
      setFocus(-1);
      setSelected(-1);
      setDetail(null);
      setTab('inspect');
      setLens(null);
      if (onActiveKeyChange) onActiveKeyChange(next);
      else setOwnKey(next);
    },
    [onActiveKeyChange],
  );

  const handleSelect = useCallback((i: NodeIx) => {
    setSelected(i);
    // Selecting anything else leaves the detail ring; the panel reopens it on request.
    setDetail(null);
  }, []);

  const handleFocus = useCallback((i: NodeIx) => {
    setFocus(i);
  }, []);

  const handleToggle = useCallback((k: keyof OrreryLayerToggles) => {
    setShow((prev) => ({ ...prev, [k]: !prev[k] }));
  }, []);

  const handleOpenDetail = useCallback((d: LineDetail) => {
    setDetail(d);
    setSelected(d.i);
  }, []);

  const handleCloseDetail = useCallback(() => {
    setDetail(null);
  }, []);

  const handleControls = useCallback((c: OrreryStageControls | null) => {
    controls.current = c;
  }, []);

  const handleZoom = useCallback((factor: number) => {
    if (factor > 1) controls.current?.zoomIn();
    else controls.current?.zoomOut();
  }, []);

  const handleFit = useCallback(() => {
    controls.current?.fit();
  }, []);

  // Climbing out past the root leaves the detail ring too — the line it described is no longer
  // anywhere on screen.
  const handleUp = useCallback(() => {
    setDetail(null);
  }, []);

  const datasetOptions = useMemo(
    () => datasets.map((d) => ({ key: d.key, label: d.label })),
    [datasets],
  );

  if (!dataset || !model) return null;

  // Until the user dives, the wheel is re-rooted on the whole story. Carrying -1 through to the
  // children left the breadcrumbs with nothing to draw, so neither crumb role rendered at all.
  const effectiveFocus = focus >= 0 ? focus : model.root;

  return (
    <div className={className} data-orrery-theme={theme} data-role="orrery-root">
      <OrreryChrome
        model={model}
        focus={effectiveFocus}
        datasets={datasetOptions}
        activeDataset={dataset.key}
        onDataset={chooseDataset}
        lens={lens}
        onLens={setLens}
        show={show}
        onToggle={handleToggle}
        onFocus={handleFocus}
        onSelect={handleSelect}
        selected={selected}
        help={help}
        onHelp={setHelp}
        onZoom={handleZoom}
        onFit={handleFit}
      />
      <div data-role="orrery-main">
        <OrreryStage
          model={model}
          focus={effectiveFocus}
          selected={selected}
          lens={lens}
          show={show}
          onFocus={handleFocus}
          onSelect={handleSelect}
          onOpenDetail={handleOpenDetail}
          onControls={handleControls}
          onUp={handleUp}
        />
        <OrreryPanel
          model={model}
          selected={selected}
          detail={detail}
          tab={tab}
          onTab={setTab}
          onSelect={handleSelect}
          onCloseDetail={handleCloseDetail}
          focus={effectiveFocus}
          onOpenDetail={handleOpenDetail}
          help={help}
          onHelp={setHelp}
        />
      </div>
    </div>
  );
}
