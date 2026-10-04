'use client';

/**
 * The wheel stage: the canvases, the camera, hit-testing, and every pointer and keyboard gesture.
 *
 * Ported from the winning prototype of the `storymap` design contest (variant A/3 "Orrery"), which
 * the owner chose for its compactness and the smoothness of its navigation. The prototype IS the
 * specification; the geometry it computes now lives in `@/lib/story/orrery` and nothing here
 * recomputes it.
 *
 * ── What this component owns, and what it deliberately does not ─────────────────────────────────
 * It owns the camera, the hover and the three canvas layers. It owns no application state: `focus`
 * and `selected` arrive as props and it asks for changes through `onFocus` / `onSelect`, so the
 * wheel, the chrome and the panel can never disagree about where you are.
 *
 * Two canvases and one offscreen bitmap, because that is what makes a pan free:
 *   - the **scene** canvas shows a bitmap baked at rest and merely blitted during a gesture,
 *   - the **overlay** canvas carries hover, selection and relations, and is cheap to repaint,
 *   - the **bake** canvas is offscreen and wider than the stage (see `render/engine.ts`).
 * A drag therefore produces zero React renders and zero re-bakes; `data-bakes` on the stage element
 * is the measurement, and a test asserts it.
 *
 * ── Three optional props the committed contract did not have ─────────────────────────────────────
 * `onStats`, `onControls` and `onUp` are optional additions, exactly as the panel package added its
 * own: the contract has no channel for the two things the chrome needs from the camera — the
 * drawn-after-culling counts for its status line, and the zoom / fit / up buttons, which rule 8 says
 * must exist as real buttons. Nothing here depends on them; omitted, the stage still works, the
 * counts are still readable off the DOM (`data-drawn`, `data-blocks`, `data-chords`, `data-labels`,
 * `data-units`, `data-bakes`) and still broadcast as an `orrery:stats` event on the stage element.
 *
 * ── Why there is no live region here ────────────────────────────────────────────────────────────
 * The winner's `#live` is a sibling of `#main`, not a child of the stage, and the chrome package
 * ports it there. A second live region inside the stage would announce everything twice, so the
 * stage announces only ITSELF (`role="application"`, `aria-roledescription`, a real `aria-label`
 * naming every key) and leaves the running commentary to the one region that exists. The host must
 * pass `selected` to `OrreryChrome` for keyboard moves to be spoken.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { buildLineDetail } from '@/lib/story/orrery';
import type { LineDetail, NodeIx, OrreryModel } from '@/lib/story/orrery';
import { useOrreryCamera } from '@/components/story/orrery/useOrreryCamera';
import type { DrawStats } from '@/components/story/orrery/render/ctx';
import { describeHub, describeShort, STAGE_LABEL } from '@/components/story/orrery/render/describe';
import { displayRoot } from '@/components/story/orrery/render/derive';
import { KEY_ZOOM_STEP, resolveKey } from '@/components/story/orrery/render/keyboard';
import type { Hit } from '@/components/story/orrery/render/hitTest';
import { logger } from '@/lib/logger';

export interface OrreryStageProps {
  model: OrreryModel;
  focus: NodeIx;
  selected: NodeIx;
  lens: string | null;
  show: { impact: boolean; paths: boolean; influence: boolean; flags: boolean };
  onFocus: (i: NodeIx) => void;
  onSelect: (i: NodeIx) => void;
  onOpenDetail: (d: LineDetail) => void;
  /** Published once per bake, never during a gesture. */
  onStats?: (stats: OrreryStageStats) => void;
  /** Handed the camera's controls on mount, and `null` on unmount. For the chrome's buttons. */
  onControls?: (controls: OrreryStageControls | null) => void;
  /** Called when the user climbs out past the root, so the host can close a detail layer. */
  onUp?: () => void;
}

/** What the wheel actually drew. The honest status line the prototype showed, kept. */
export type OrreryStageStats = DrawStats & { bakes: number };

/** Rule 8: zoom and fit must exist as real buttons. The chrome renders them and calls these. */
export interface OrreryStageControls {
  zoomIn: () => void;
  zoomOut: () => void;
  fit: () => void;
  up: () => void;
  /** Move keyboard focus to the wheel, for a "back to the map" affordance. */
  focusStage: () => void;
}

interface Tip {
  x: number;
  y: number;
  title: string;
  detail: string;
  /**
   * The model the tip describes. A tip is about a node in ONE document; when the host swaps the
   * document the old tip is stale, and the render below drops it by comparing this rather than by
   * clearing state in an effect.
   */
  model: OrreryModel;
}

export function OrreryStage({
  model,
  focus,
  selected,
  lens,
  show,
  onFocus,
  onSelect,
  onOpenDetail,
  onStats,
  onControls,
  onUp,
}: OrreryStageProps) {
  const root = displayRoot(model);
  const safeFocus = focus >= 0 && focus < model.R.length ? focus : root;
  const [tip, setTip] = useState<Tip | null>(null);
  const draggingRef = useRef(false);
  const pointerRef = useRef({ x: 0, y: 0 });
  /** The stage element, held separately so the stats writer does not depend on the camera hook. */
  const stageElRef = useRef<HTMLDivElement | null>(null);
  const onStatsRef = useRef(onStats);
  /** The two navigation intents, mirrored for the controls handshake (see the effect below). */
  const intentRef = useRef<{ up: () => void; activate: (i: NodeIx) => void }>({
    up: () => undefined,
    activate: () => undefined,
  });

  // One object per meaningful change, so the engine's `setProps` effect does not fire per render.
  const engineProps = useMemo(
    () => ({ model, focus: safeFocus, selected, lens, show }),
    [model, safeFocus, selected, lens, show],
  );

  const handleStats = useCallback((stats: OrreryStageStats) => {
    const stage = stageElRef.current;
    if (stage) {
      // Written imperatively: the counts stay honest and visible without costing a render.
      stage.setAttribute('data-drawn', String(stats.drawn));
      stage.setAttribute('data-blocks', String(stats.blocks));
      stage.setAttribute('data-chords', String(stats.chords));
      stage.setAttribute('data-labels', String(stats.labels));
      stage.setAttribute('data-units', String(stats.units));
      stage.setAttribute('data-bakes', String(stats.bakes));
      stage.dispatchEvent(new CustomEvent('orrery:stats', { detail: stats, bubbles: true }));
    }
    onStatsRef.current?.(stats);
  }, []);

  const handleHover = useCallback(
    (hit: Hit | null) => {
      if (!hit) {
        setTip(null);
        return;
      }
      const n = model.R[hit.i];
      if (!n) {
        setTip(null);
        return;
      }
      const p = pointerRef.current;
      setTip({
        x: p.x,
        y: p.y,
        model,
        title: hit.zone === 'hub' && n.virtual ? model.raw.project : n.title,
        detail:
          hit.zone === 'hub'
            ? describeHub(model, safeFocus, root)
            : describeShort(model, n) + (hit.zone === 'rim' ? ' · impact rim' : ''),
      });
    },
    [model, safeFocus, root],
  );

  const { stageRef, mainRef, overlayRef, engine } = useOrreryCamera({
    props: engineProps,
    onStats: handleStats,
    onHover: handleHover,
  });

  /* ---------------------------------------------------------------- navigation intents */

  const goUp = () => {
    const current = engine();
    if (model.flat) {
      if (selected >= 0) {
        const parent = model.R[selected].par;
        onSelect(parent >= 0 && model.flat.items.has(parent) ? parent : -1);
        return;
      }
      current?.fit();
      onUp?.();
      return;
    }
    if (safeFocus === root) {
      if (selected >= 0) onSelect(-1);
      else current?.fit();
      onUp?.();
      return;
    }
    // Climbing out leaves the node you came from selected, so you never lose your place.
    onSelect(safeFocus);
    const parent = model.R[safeFocus].par;
    onFocus(parent >= 0 ? parent : root);
  };

  const activate = (i: NodeIx) => {
    const n = model.R[i];
    if (!n) return;
    onSelect(i);
    if (model.flat) {
      engine()?.frameNode(i);
    } else if (n.kids.length > 0 && i !== safeFocus && !n.dock) {
      // A container: dive into it. One eased glide — the move the owner chose this variant for.
      onFocus(i);
      return;
    }
    // A leaf is the fourth level the owner asked for: explain the line, do not zoom at it.
    if (n.kids.length === 0 && !n.dock) {
      const detail = buildLineDetail(model, i);
      if (detail) onOpenDetail(detail);
      else logger.warn('[orrery] no line detail for node index', i);
    }
  };

  // Refs are written in an effect, never during render, and only so the stable controls object
  // below can reach the latest closures.
  useEffect(() => {
    onStatsRef.current = onStats;
    intentRef.current = { up: goUp, activate };
  });

  /* ---------------------------------------------------------------- pointer */

  const localPoint = (e: { clientX: number; clientY: number }) => {
    const stage = stageElRef.current;
    if (!stage) return { x: 0, y: 0 };
    const rect = stage.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    e.currentTarget.setAttribute('data-drag', '1');
    const p = localPoint(e);
    draggingRef.current = true;
    engine()?.beginDrag(p.x, p.y);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const p = localPoint(e);
    pointerRef.current = p;
    const current = engine();
    if (!current) return;
    if (draggingRef.current && current.dragTo(p.x, p.y)) {
      // THE fast path. The only state touched on this line is the camera, inside the engine.
      if (tip) setTip(null);
      return;
    }
    const hit = current.hitAt(p.x, p.y);
    current.setHover(hit);
    e.currentTarget.setAttribute('data-hand', hit ? '1' : '0');
    if (hit && tip && tip.model === model) setTip({ ...tip, x: p.x, y: p.y });
  };

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const current = engine();
    draggingRef.current = false;
    e.currentTarget.setAttribute('data-drag', '0');
    if (!current) return;
    if (current.endDrag()) return;
    const p = localPoint(e);
    const hit = current.hitAt(p.x, p.y);
    if (!hit) {
      if (selected >= 0) onSelect(-1);
      return;
    }
    if (hit.zone === 'hub') {
      goUp();
      return;
    }
    activate(hit.i);
  };

  const onPointerLeave = (e: React.PointerEvent<HTMLDivElement>) => {
    if (draggingRef.current) return;
    engine()?.setHover(null);
    e.currentTarget.setAttribute('data-hand', '0');
    setTip(null);
  };

  // Wheel is attached natively: React routes wheel through a passive root listener, so
  // `preventDefault` there would be ignored and the page would scroll under the gesture.
  useEffect(() => {
    const el = overlayRef.current?.parentElement;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      e.preventDefault();
      const stage = stageElRef.current;
      if (!stage) return;
      const rect = stage.getBoundingClientRect();
      engine()?.wheelZoom(e.clientX - rect.left, e.clientY - rect.top, e.deltaY, e.deltaMode);
      setTip(null);
    };
    el.addEventListener('wheel', handler, { passive: false });
    return () => el.removeEventListener('wheel', handler);
  }, [engine, overlayRef]);

  /* ---------------------------------------------------------------- keyboard */

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const current = engine();
    if (!current) return;
    const intent = resolveKey(current.view(), selected, e.key);
    switch (intent.kind) {
      case 'select':
        onSelect(intent.i);
        break;
      case 'activate':
        activate(intent.i);
        break;
      case 'up':
        goUp();
        break;
      case 'zoom':
        current.zoomBy(intent.factor);
        break;
      case 'fit':
        current.fit();
        break;
      case 'home':
        if (model.flat) current.fit();
        else onFocus(root);
        break;
      default:
        return;
    }
    e.preventDefault();
  };

  /* ---------------------------------------------------------------- controls handshake */

  useEffect(() => {
    if (!onControls) return;
    const controls: OrreryStageControls = {
      zoomIn: () => engine()?.zoomBy(KEY_ZOOM_STEP),
      zoomOut: () => engine()?.zoomBy(1 / KEY_ZOOM_STEP),
      fit: () => engine()?.fit(),
      up: () => intentRef.current.up(),
      focusStage: () => {
        const el = overlayRef.current?.parentElement as HTMLElement | null;
        el?.focus({ preventScroll: true });
      },
    };
    onControls(controls);
    return () => onControls(null);
  }, [onControls, engine, overlayRef]);

  /* ---------------------------------------------------------------- markup */

  return (
    <div
      data-role="orrery-stage"
      ref={(el) => {
        stageRef.current = el;
        stageElRef.current = el;
      }}
    >
      <div
        data-role="orrery-canvas"
        role="application"
        tabIndex={0}
        aria-roledescription="story wheel"
        aria-label={STAGE_LABEL}
        data-drag="0"
        data-hand="0"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onPointerLeave={onPointerLeave}
        onKeyDown={onKeyDown}
      >
        <canvas ref={mainRef} aria-hidden="true" />
        <canvas ref={overlayRef} aria-hidden="true" />
      </div>
      {tip && tip.model === model ? <StageTip tip={tip} /> : null}
    </div>
  );
}

/**
 * The hover tip. Placed in CSS pixels against the stage and flipped when it would leave it, so a
 * node near the right or bottom edge still explains itself.
 *
 * The placement is written straight to the element's style rather than held in state: it depends on
 * the tip's own measured size, which is only knowable after it has rendered, and a setState there
 * would be a cascading render on every pointer move.
 */
function StageTip({ tip }: { tip: Tip }) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    const stage = el?.parentElement;
    if (!el || !stage) return;
    let left = tip.x + 14;
    let top = tip.y + 16;
    if (left + el.offsetWidth > stage.clientWidth - 6) left = tip.x - el.offsetWidth - 12;
    if (top + el.offsetHeight > stage.clientHeight - 6) top = tip.y - el.offsetHeight - 10;
    el.style.left = `${Math.max(4, left)}px`;
    el.style.top = `${Math.max(4, top)}px`;
  }, [tip]);

  return (
    <div data-role="orrery-tip" role="presentation" ref={ref} style={{ left: tip.x + 14, top: tip.y + 16 }}>
      <b>{tip.title}</b>
      <em>{tip.detail}</em>
    </div>
  );
}
