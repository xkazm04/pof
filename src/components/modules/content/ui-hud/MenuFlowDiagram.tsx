'use client';

import { useState, useCallback, useRef, useMemo } from 'react';
import {
  Plus, Link, Unlink, Send, Loader2,
  X, ChevronDown,
} from 'lucide-react';
import { SurfaceCard } from '@/components/ui/SurfaceCard';

// ── Types ──

export type ScreenType =
  | 'main-menu'
  | 'settings'
  | 'pause-menu'
  | 'hud'
  | 'loading'
  | 'splash'
  | 'popup'
  | 'custom';

export interface ScreenNode {
  id: string;
  name: string;
  type: ScreenType;
  x: number;
  y: number;
  widgets: string[];
}

export interface ScreenTransition {
  id: string;
  fromId: string;
  toId: string;
  trigger: string;
  bidirectional: boolean;
}

export interface MenuFlowConfig {
  screens: ScreenNode[];
  transitions: ScreenTransition[];
}

// ── Constants ──

const NODE_W = 170;
const NODE_H = 72;
const CONTENT_ACCENT = '#f59e0b';

const SCREEN_TYPES: Record<ScreenType, { color: string; label: string; icon: string }> = {
  'main-menu':  { color: '#60a5fa', label: 'Main Menu',  icon: 'M' },
  'settings':   { color: '#a78bfa', label: 'Settings',   icon: 'S' },
  'pause-menu': { color: '#fbbf24', label: 'Pause Menu', icon: 'P' },
  'hud':        { color: '#34d399', label: 'HUD',        icon: 'H' },
  'loading':    { color: '#8b8fb0', label: 'Loading',    icon: 'L' },
  'splash':     { color: '#f472b6', label: 'Splash',     icon: '◆' },
  'popup':      { color: '#fb923c', label: 'Popup',      icon: '□' },
  'custom':     { color: 'var(--text-muted)', label: 'Custom',     icon: '?' },
};

const DEFAULT_SCREENS: ScreenNode[] = [
  { id: 'scr-main',     name: 'Main Menu',     type: 'main-menu',  x: 60,  y: 120, widgets: ['Play Button', 'Settings Button', 'Quit Button'] },
  { id: 'scr-settings', name: 'Settings',      type: 'settings',   x: 320, y: 40,  widgets: ['Graphics Tab', 'Audio Tab', 'Controls Tab', 'Back Button'] },
  { id: 'scr-pause',    name: 'Pause Menu',    type: 'pause-menu', x: 320, y: 220, widgets: ['Resume Button', 'Settings Button', 'Quit Button'] },
];

const DEFAULT_TRANSITIONS: ScreenTransition[] = [
  { id: 'tr-1', fromId: 'scr-main',  toId: 'scr-settings', trigger: 'Settings Button', bidirectional: true },
  { id: 'tr-2', fromId: 'scr-pause', toId: 'scr-settings', trigger: 'Settings Button', bidirectional: true },
];

export const DEFAULT_MENU_FLOW: MenuFlowConfig = {
  screens: DEFAULT_SCREENS,
  transitions: DEFAULT_TRANSITIONS,
};

// ── Props ──

interface MenuFlowDiagramProps {
  onGenerate: (config: MenuFlowConfig) => void;
  isGenerating: boolean;
}

// ── Component ──

export function MenuFlowDiagram({ onGenerate, isGenerating }: MenuFlowDiagramProps) {
  const [screens, setScreens] = useState<ScreenNode[]>(() => structuredClone(DEFAULT_SCREENS));
  const [transitions, setTransitions] = useState<ScreenTransition[]>(() => structuredClone(DEFAULT_TRANSITIONS));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [connectingFrom, setConnectingFrom] = useState<string | null>(null);
  const [editingScreen, setEditingScreen] = useState<string | null>(null);

  // Pan + drag state
  const svgRef = useRef<SVGSVGElement>(null);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
  const [dragState, setDragState] = useState<{
    screenId: string;
    offsetX: number;
    offsetY: number;
  } | null>(null);

  // ── CRUD ──

  const addScreen = useCallback(() => {
    const id = `scr-${Date.now()}`;
    const newScreen: ScreenNode = {
      id,
      name: `Screen ${screens.length + 1}`,
      type: 'custom',
      x: 160 + Math.random() * 140 - pan.x,
      y: 100 + Math.random() * 140 - pan.y,
      widgets: [],
    };
    setScreens((prev) => [...prev, newScreen]);
    setSelectedId(id);
    setEditingScreen(id);
  }, [screens.length, pan]);

  const deleteScreen = useCallback((id: string) => {
    setScreens((prev) => prev.filter((s) => s.id !== id));
    setTransitions((prev) => prev.filter((t) => t.fromId !== id && t.toId !== id));
    if (selectedId === id) setSelectedId(null);
    if (editingScreen === id) setEditingScreen(null);
  }, [selectedId, editingScreen]);

  const updateScreen = useCallback((id: string, patch: Partial<ScreenNode>) => {
    setScreens((prev) => prev.map((s) => s.id === id ? { ...s, ...patch } : s));
  }, []);

  // ── Connections ──

  const startConnection = useCallback((fromId: string) => {
    setConnectingFrom(fromId);
  }, []);

  const completeConnection = useCallback((toId: string) => {
    if (!connectingFrom || connectingFrom === toId) {
      setConnectingFrom(null);
      return;
    }
    const exists = transitions.some(
      (t) => (t.fromId === connectingFrom && t.toId === toId) ||
             (t.fromId === toId && t.toId === connectingFrom)
    );
    if (!exists) {
      setTransitions((prev) => [
        ...prev,
        {
          id: `tr-${Date.now()}`,
          fromId: connectingFrom,
          toId,
          trigger: 'Button Click',
          bidirectional: false,
        },
      ]);
    }
    setConnectingFrom(null);
  }, [connectingFrom, transitions]);

  const deleteTransition = useCallback((id: string) => {
    setTransitions((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toggleBidirectional = useCallback((id: string) => {
    setTransitions((prev) =>
      prev.map((t) => t.id === id ? { ...t, bidirectional: !t.bidirectional } : t)
    );
  }, []);

  // ── SVG interaction ──

  const getSVGPoint = useCallback((e: React.MouseEvent) => {
    if (!svgRef.current) return { x: 0, y: 0 };
    const rect = svgRef.current.getBoundingClientRect();
    return {
      x: e.clientX - rect.left - pan.x,
      y: e.clientY - rect.top - pan.y,
    };
  }, [pan]);

  const handleNodeMouseDown = useCallback((e: React.MouseEvent, screenId: string) => {
    e.stopPropagation();
    if (connectingFrom) {
      completeConnection(screenId);
      return;
    }
    const pt = getSVGPoint(e);
    const scr = screens.find((s) => s.id === screenId);
    if (!scr) return;
    setDragState({
      screenId,
      offsetX: pt.x - scr.x,
      offsetY: pt.y - scr.y,
    });
    setSelectedId(screenId);
  }, [connectingFrom, completeConnection, getSVGPoint, screens]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isPanning) {
      setPan({
        x: e.clientX - panStart.current.x + panStart.current.panX,
        y: e.clientY - panStart.current.y + panStart.current.panY,
      });
      return;
    }
    if (!dragState) return;
    const pt = getSVGPoint(e);
    setScreens((prev) =>
      prev.map((s) =>
        s.id === dragState.screenId
          ? { ...s, x: pt.x - dragState.offsetX, y: pt.y - dragState.offsetY }
          : s
      )
    );
  }, [dragState, isPanning, getSVGPoint]);

  const handleMouseUp = useCallback(() => {
    setDragState(null);
    setIsPanning(false);
  }, []);

  const handleSvgMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.target === svgRef.current || (e.target as SVGElement).tagName === 'rect') {
      if (connectingFrom) {
        setConnectingFrom(null);
        return;
      }
      panStart.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
      setIsPanning(true);
      setSelectedId(null);
      setEditingScreen(null);
    }
  }, [connectingFrom, pan]);

  // ── Helpers ──

  const getNodeCenter = useCallback((id: string) => {
    const s = screens.find((scr) => scr.id === id);
    if (!s) return { x: 0, y: 0 };
    return { x: s.x + NODE_W / 2, y: s.y + NODE_H / 2 };
  }, [screens]);

  const selectedScreen = useMemo(
    () => editingScreen ? screens.find((s) => s.id === editingScreen) : null,
    [editingScreen, screens]
  );

  const config: MenuFlowConfig = useMemo(() => ({ screens, transitions }), [screens, transitions]);

  // ── Arrow head math ──

  const getArrowPath = useCallback(
    (from: { x: number; y: number }, to: { x: number; y: number }, bidir: boolean) => {
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len < 1) return { line: '', arrows: '' };

      const ux = dx / len;
      const uy = dy / len;

      // Offset from center by half the node diagonal for cleaner endpoints
      const offset = 40;
      const fx = from.x + ux * offset;
      const fy = from.y + uy * offset;
      const tx = to.x - ux * offset;
      const ty = to.y - uy * offset;

      const line = `M${fx},${fy} L${tx},${ty}`;

      // Arrow head at target
      const arrowSize = 8;
      const ax1 = tx - ux * arrowSize - uy * arrowSize * 0.5;
      const ay1 = ty - uy * arrowSize + ux * arrowSize * 0.5;
      const ax2 = tx - ux * arrowSize + uy * arrowSize * 0.5;
      const ay2 = ty - uy * arrowSize - ux * arrowSize * 0.5;
      let arrows = `M${tx},${ty} L${ax1},${ay1} M${tx},${ty} L${ax2},${ay2}`;

      if (bidir) {
        const bx1 = fx + ux * arrowSize - uy * arrowSize * 0.5;
        const by1 = fy + uy * arrowSize + ux * arrowSize * 0.5;
        const bx2 = fx + ux * arrowSize + uy * arrowSize * 0.5;
        const by2 = fy + uy * arrowSize - ux * arrowSize * 0.5;
        arrows += ` M${fx},${fy} L${bx1},${by1} M${fx},${fy} L${bx2},${by2}`;
      }

      return { line, arrows, midX: (fx + tx) / 2, midY: (fy + ty) / 2 };
    },
    []
  );

  return (
    <div className="space-y-4">
      {/* Canvas area */}
      <div className="relative w-full bg-[#080818] rounded-lg border border-border overflow-hidden" style={{ height: 380 }}>
        {/* Toolbar */}
        <div className="absolute top-2 left-2 z-10 flex items-center gap-1">
          <button
            onClick={addScreen}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium bg-surface border border-border-bright text-text hover:bg-surface-hover transition-colors"
          >
            <Plus className="w-3 h-3" />
            Add Screen
          </button>
          {connectingFrom ? (
            <button
              onClick={() => setConnectingFrom(null)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium bg-[#f8717118] border border-[#f8717130] text-[#f87171] transition-colors"
            >
              <Unlink className="w-3 h-3" />
              Cancel
            </button>
          ) : connectingFrom === null && selectedId && (
            <button
              onClick={() => startConnection(selectedId)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium bg-surface border border-border-bright text-text hover:bg-surface-hover transition-colors"
            >
              <Link className="w-3 h-3" />
              Connect
            </button>
          )}
        </div>

        {/* Badge */}
        <div className="absolute top-2 right-2 z-10 px-2 py-1 rounded text-xs bg-surface border border-border text-text-muted">
          {screens.length} screens &middot; {transitions.length} transitions
        </div>

        {/* SVG */}
        <svg
          ref={svgRef}
          className="w-full h-full"
          style={{ cursor: isPanning ? 'grabbing' : connectingFrom ? 'crosshair' : 'grab' }}
          onMouseDown={handleSvgMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          {/* Grid dots */}
          <defs>
            <pattern
              id="menuflow-grid"
              width="24"
              height="24"
              patternUnits="userSpaceOnUse"
              patternTransform={`translate(${pan.x % 24},${pan.y % 24})`}
            >
              <circle cx="12" cy="12" r="0.5" fill="var(--border)" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#menuflow-grid)" />

          <g transform={`translate(${pan.x},${pan.y})`}>
            {/* Transition arrows */}
            {transitions.map((tr) => {
              const from = getNodeCenter(tr.fromId);
              const to = getNodeCenter(tr.toId);
              const { line, arrows, midX, midY } = getArrowPath(from, to, tr.bidirectional);

              return (
                <g key={tr.id}>
                  {/* Visible line */}
                  <path d={line} stroke="#3a3a6a" strokeWidth={2} fill="none" />
                  <path d={arrows} stroke="#3a3a6a" strokeWidth={2} fill="none" strokeLinecap="round" />

                  {/* Trigger label */}
                  {midX !== undefined && midY !== undefined && (
                    <g transform={`translate(${midX}, ${midY})`}>
                      <rect
                        x={-tr.trigger.length * 3 - 6}
                        y={-8}
                        width={tr.trigger.length * 6 + 12}
                        height={16}
                        rx={4}
                        fill="var(--surface)"
                        stroke="var(--border)"
                        strokeWidth={1}
                      />
                      <text
                        x={0}
                        y={4}
                        fontSize={8}
                        fill="var(--text-muted)"
                        textAnchor="middle"
                        fontFamily="sans-serif"
                      >
                        {tr.trigger}
                      </text>
                    </g>
                  )}

                  {/* Clickable hit area */}
                  <path
                    d={line}
                    stroke="transparent"
                    strokeWidth={14}
                    fill="none"
                    style={{ cursor: 'pointer' }}
                    onClick={(e) => {
                      e.stopPropagation();
                      // Show a mini action row: toggle bidirectional or delete
                      toggleBidirectional(tr.id);
                    }}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      deleteTransition(tr.id);
                    }}
                  />

                  {/* Bidirectional indicator */}
                  {tr.bidirectional && midX !== undefined && midY !== undefined && (
                    <circle cx={midX} cy={midY - 14} r={3} fill="#3a3a6a" />
                  )}
                </g>
              );
            })}

            {/* Screen nodes */}
            {screens.map((scr) => {
              const cfg = SCREEN_TYPES[scr.type];
              const isSelected = selectedId === scr.id;
              const isConnectTarget = connectingFrom !== null && connectingFrom !== scr.id;

              return (
                <g
                  key={scr.id}
                  transform={`translate(${scr.x},${scr.y})`}
                  onMouseDown={(e) => handleNodeMouseDown(e, scr.id)}
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    setEditingScreen(scr.id);
                  }}
                  onClick={() => {
                    if (isConnectTarget) completeConnection(scr.id);
                  }}
                  style={{
                    cursor: dragState?.screenId === scr.id
                      ? 'grabbing'
                      : isConnectTarget
                        ? 'crosshair'
                        : 'pointer',
                  }}
                >
                  {/* Selection glow */}
                  {isSelected && (
                    <rect
                      x={-3} y={-3}
                      width={NODE_W + 6} height={NODE_H + 6}
                      rx={11} ry={11}
                      fill="none"
                      stroke={CONTENT_ACCENT}
                      strokeWidth={2}
                      opacity={0.5}
                    />
                  )}

                  {/* Connect-target highlight */}
                  {isConnectTarget && (
                    <rect
                      x={-2} y={-2}
                      width={NODE_W + 4} height={NODE_H + 4}
                      rx={10} ry={10}
                      fill="none"
                      stroke="#fbbf24"
                      strokeWidth={1.5}
                      strokeDasharray="4,3"
                      opacity={0.7}
                    />
                  )}

                  {/* Node body */}
                  <rect
                    x={0} y={0}
                    width={NODE_W} height={NODE_H}
                    rx={8} ry={8}
                    fill="var(--surface)"
                    stroke={isSelected ? CONTENT_ACCENT : `${cfg.color}40`}
                    strokeWidth={isSelected ? 2 : 1}
                  />

                  {/* Colored top bar */}
                  <rect
                    x={0} y={0}
                    width={NODE_W} height={4}
                    rx={8} ry={8}
                    fill={cfg.color}
                    opacity={0.6}
                  />
                  {/* Cover bottom corners of top bar */}
                  <rect x={0} y={2} width={NODE_W} height={2} fill={cfg.color} opacity={0.6} />
                  <rect x={0} y={4} width={NODE_W} height={1} fill="var(--surface)" />

                  {/* Type icon circle */}
                  <circle cx={18} cy={26} r={8} fill={`${cfg.color}20`} stroke={`${cfg.color}40`} strokeWidth={1} />
                  <text
                    x={18} y={30}
                    fontSize={9}
                    fill={cfg.color}
                    textAnchor="middle"
                    fontFamily="sans-serif"
                    fontWeight={700}
                  >
                    {cfg.icon}
                  </text>

                  {/* Screen name */}
                  <text x={32} y={30} fontSize={11} fill="var(--text)" fontFamily="sans-serif" fontWeight={600}>
                    {scr.name.length > 15 ? scr.name.slice(0, 15) + '…' : scr.name}
                  </text>

                  {/* Type label */}
                  <text x={32} y={44} fontSize={8} fill="var(--text-muted)" fontFamily="sans-serif">
                    {cfg.label}
                  </text>

                  {/* Widget count */}
                  <text x={32} y={58} fontSize={7} fill="#4a4e6a" fontFamily="sans-serif">
                    {scr.widgets.length} widget{scr.widgets.length !== 1 ? 's' : ''}
                  </text>

                  {/* Action buttons when selected */}
                  {isSelected && (
                    <>
                      {/* Link button */}
                      <g
                        transform={`translate(${NODE_W - 38}, 10)`}
                        onClick={(e) => {
                          e.stopPropagation();
                          startConnection(scr.id);
                        }}
                        style={{ cursor: 'pointer' }}
                      >
                        <rect x={0} y={0} width={14} height={14} rx={3} fill="var(--border)" />
                        <text x={3.5} y={11} fontSize={9} fill="var(--text-muted-hover)">⟶</text>
                      </g>
                      {/* Delete button */}
                      <g
                        transform={`translate(${NODE_W - 20}, 10)`}
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteScreen(scr.id);
                        }}
                        style={{ cursor: 'pointer' }}
                      >
                        <rect x={0} y={0} width={14} height={14} rx={3} fill="#f8717118" />
                        <text x={3} y={11} fontSize={10} fill="#f87171">&times;</text>
                      </g>
                    </>
                  )}
                </g>
              );
            })}
          </g>
        </svg>

        {/* Help text */}
        {connectingFrom && (
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-10 px-3 py-1.5 rounded-full text-xs bg-[#fbbf2418] border border-[#fbbf2430] text-[#fbbf24]">
            Click a target screen to connect, or click canvas to cancel
          </div>
        )}
      </div>

      {/* ── Screen Editor Panel ── */}
      {selectedScreen && editingScreen && (
        <ScreenEditor
          screen={selectedScreen}
          onUpdate={(patch) => updateScreen(editingScreen, patch)}
          onClose={() => setEditingScreen(null)}
        />
      )}

      {/* ── Transition List ── */}
      {transitions.length > 0 && (
        <SurfaceCard level={2} className="p-3">
          <div className="text-2xs uppercase tracking-wider text-text-muted font-semibold mb-2">
            Transitions
          </div>
          <div className="space-y-1">
            {transitions.map((tr) => {
              const fromScr = screens.find((s) => s.id === tr.fromId);
              const toScr = screens.find((s) => s.id === tr.toId);
              if (!fromScr || !toScr) return null;
              return (
                <div
                  key={tr.id}
                  className="flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-surface border border-border text-xs"
                >
                  <span className="text-text font-medium">{fromScr.name}</span>
                  <span className="text-[#4a4e6a]">{tr.bidirectional ? '⟷' : '→'}</span>
                  <span className="text-text font-medium">{toScr.name}</span>
                  <span className="text-text-muted ml-auto truncate max-w-[100px]">{tr.trigger}</span>
                  <button
                    onClick={() => toggleBidirectional(tr.id)}
                    className="text-2xs px-1.5 py-0.5 rounded border transition-colors"
                    style={{
                      color: tr.bidirectional ? '#60a5fa' : 'var(--text-muted)',
                      borderColor: tr.bidirectional ? '#60a5fa30' : 'var(--border)',
                      backgroundColor: tr.bidirectional ? '#60a5fa08' : 'transparent',
                    }}
                    title="Toggle bidirectional"
                  >
                    {tr.bidirectional ? '⟷' : '→'}
                  </button>
                  <button
                    onClick={() => deleteTransition(tr.id)}
                    className="text-[#f87171] hover:text-[#fca5a5] transition-colors"
                    title="Delete transition"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              );
            })}
          </div>
        </SurfaceCard>
      )}

      {/* ── Summary & Generate ── */}
      <div className="border-t border-border pt-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-4 text-xs text-text-muted-hover">
            <span>{screens.length} screen{screens.length !== 1 ? 's' : ''}</span>
            <span className="text-[#2a2a4a]">|</span>
            <span>{transitions.length} transition{transitions.length !== 1 ? 's' : ''}</span>
            <span className="text-[#2a2a4a]">|</span>
            <span>{screens.reduce((n, s) => n + s.widgets.length, 0)} total widgets</span>
          </div>
        </div>
        <button
          onClick={() => onGenerate(config)}
          disabled={isGenerating || screens.length === 0}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-xs font-semibold transition-all disabled:opacity-50"
          style={{
            backgroundColor: `${CONTENT_ACCENT}18`,
            color: CONTENT_ACCENT,
            border: `1px solid ${CONTENT_ACCENT}35`,
          }}
        >
          {isGenerating ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Generating Navigation System...
            </>
          ) : (
            <>
              <Send className="w-4 h-4" />
              Generate Menu System with Claude
            </>
          )}
        </button>
      </div>
    </div>
  );
}

// ── Screen Editor Sub-component ──

function ScreenEditor({
  screen,
  onUpdate,
  onClose,
}: {
  screen: ScreenNode;
  onUpdate: (patch: Partial<ScreenNode>) => void;
  onClose: () => void;
}) {
  const [newWidget, setNewWidget] = useState('');

  const addWidget = useCallback(() => {
    const name = newWidget.trim();
    if (!name) return;
    onUpdate({ widgets: [...screen.widgets, name] });
    setNewWidget('');
  }, [newWidget, screen.widgets, onUpdate]);

  const removeWidget = useCallback((idx: number) => {
    onUpdate({ widgets: screen.widgets.filter((_, i) => i !== idx) });
  }, [screen.widgets, onUpdate]);

  const cfg = SCREEN_TYPES[screen.type];

  return (
    <SurfaceCard level={2} className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div
            className="w-5 h-5 rounded flex items-center justify-center text-xs font-bold"
            style={{ backgroundColor: `${cfg.color}20`, color: cfg.color }}
          >
            {cfg.icon}
          </div>
          <span className="text-xs font-semibold text-text">Edit Screen</span>
        </div>
        <button onClick={onClose} className="text-text-muted hover:text-text transition-colors">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Name */}
      <div className="space-y-1">
        <label className="text-2xs uppercase tracking-wider text-text-muted font-semibold">Name</label>
        <input
          type="text"
          value={screen.name}
          onChange={(e) => onUpdate({ name: e.target.value })}
          className="w-full px-2.5 py-1.5 bg-surface border border-border rounded text-xs text-text outline-none focus:border-[#f59e0b40] transition-colors"
        />
      </div>

      {/* Type */}
      <div className="space-y-1">
        <label className="text-2xs uppercase tracking-wider text-text-muted font-semibold">Type</label>
        <div className="relative">
          <select
            value={screen.type}
            onChange={(e) => onUpdate({ type: e.target.value as ScreenType })}
            className="w-full px-2.5 py-1.5 bg-surface border border-border rounded text-xs text-text outline-none focus:border-[#f59e0b40] appearance-none transition-colors"
          >
            {(Object.entries(SCREEN_TYPES) as [ScreenType, typeof SCREEN_TYPES[ScreenType]][]).map(([key, val]) => (
              <option key={key} value={key}>{val.label}</option>
            ))}
          </select>
          <ChevronDown className="w-3 h-3 text-text-muted absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>
      </div>

      {/* Widgets */}
      <div className="space-y-1.5">
        <label className="text-2xs uppercase tracking-wider text-text-muted font-semibold">
          Widgets / Elements ({screen.widgets.length})
        </label>
        {screen.widgets.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {screen.widgets.map((w, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border transition-colors"
                style={{
                  color: cfg.color,
                  borderColor: `${cfg.color}30`,
                  backgroundColor: `${cfg.color}08`,
                }}
              >
                {w}
                <button
                  onClick={() => removeWidget(i)}
                  className="hover:text-[#f87171] transition-colors"
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              </span>
            ))}
          </div>
        )}
        <div className="flex gap-1.5">
          <input
            type="text"
            value={newWidget}
            onChange={(e) => setNewWidget(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') addWidget(); }}
            placeholder="e.g. Play Button, Health Bar..."
            className="flex-1 px-2.5 py-1.5 bg-surface border border-border rounded text-xs text-text placeholder-[#4a4e6a] outline-none focus:border-[#f59e0b40] transition-colors"
          />
          <button
            onClick={addWidget}
            disabled={!newWidget.trim()}
            className="px-2 py-1.5 rounded text-xs font-medium transition-colors disabled:opacity-30"
            style={{
              backgroundColor: `${CONTENT_ACCENT}15`,
              color: CONTENT_ACCENT,
              border: `1px solid ${CONTENT_ACCENT}30`,
            }}
          >
            <Plus className="w-3 h-3" />
          </button>
        </div>
      </div>
    </SurfaceCard>
  );
}
