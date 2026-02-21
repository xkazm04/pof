'use client';

import { useState, useCallback, useRef, useMemo } from 'react';
import {
  Plus, Link, Unlink, Send, Loader2,
  X, ChevronDown,
} from 'lucide-react';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { MODULE_COLORS } from '@/lib/constants';
import { STATUS_INFO, ACCENT_VIOLET, STATUS_WARNING, ACCENT_EMERALD, ACCENT_PINK, STATUS_BLOCKER, STATUS_ERROR } from '@/lib/chart-colors';

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

const SCREEN_TYPES: Record<ScreenType, { color: string; label: string; icon: string }> = {
  'main-menu': { color: STATUS_INFO, label: 'Main Menu', icon: 'M' },
  'settings': { color: ACCENT_VIOLET, label: 'Settings', icon: 'S' },
  'pause-menu': { color: STATUS_WARNING, label: 'Pause Menu', icon: 'P' },
  'hud': { color: ACCENT_EMERALD, label: 'HUD', icon: 'H' },
  'loading': { color: '#8b8fb0', label: 'Loading', icon: 'L' },
  'splash': { color: ACCENT_PINK, label: 'Splash', icon: '◆' },
  'popup': { color: STATUS_BLOCKER, label: 'Popup', icon: '□' },
  'custom': { color: 'var(--text-muted)', label: 'Custom', icon: '?' },
};

const DEFAULT_SCREENS: ScreenNode[] = [
  { id: 'scr-main', name: 'Main Menu', type: 'main-menu', x: 60, y: 120, widgets: ['Play Button', 'Settings Button', 'Quit Button'] },
  { id: 'scr-settings', name: 'Settings', type: 'settings', x: 320, y: 40, widgets: ['Graphics Tab', 'Audio Tab', 'Controls Tab', 'Back Button'] },
  { id: 'scr-pause', name: 'Pause Menu', type: 'pause-menu', x: 320, y: 220, widgets: ['Resume Button', 'Settings Button', 'Quit Button'] },
];

const DEFAULT_TRANSITIONS: ScreenTransition[] = [
  { id: 'tr-1', fromId: 'scr-main', toId: 'scr-settings', trigger: 'Settings Button', bidirectional: true },
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
    <div className="space-y-6 bg-[#03030a] p-6 rounded-2xl border border-indigo-900/30 shadow-[inset_0_0_80px_rgba(99,102,241,0.05)] relative w-full overflow-hidden">
      {/* Ambient tech background */}
      <div className="absolute inset-0 pointer-events-none z-0">
        <div className="absolute -top-1/4 -right-1/4 w-[500px] h-[500px] bg-indigo-600/10 blur-[120px] rounded-full pointer-events-none" />
        <div className="absolute bottom-1/4 -left-1/4 w-[500px] h-[500px] bg-violet-600/10 blur-[120px] rounded-full pointer-events-none" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:32px_32px] [mask-image:radial-gradient(ellipse_at_center,black_20%,transparent_70%)] opacity-30 pointer-events-none" />
      </div>

      <div className="relative z-10 w-full mb-6 border-b border-indigo-900/40 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center shadow-[inset_0_0_15px_rgba(99,102,241,0.1)]">
            <Link className="w-5 h-5 text-indigo-400" />
          </div>
          <div>
            <h3 className="text-sm font-bold tracking-widest uppercase text-indigo-100 shadow-[0_0_10px_rgba(99,102,241,0.5)]">UI Node Flow Matrix</h3>
            <p className="text-[10px] text-indigo-400/60 uppercase tracking-widest mt-1">
              INTERFACE_TOPOLOGY_AND_SCREEN_ROUTING
            </p>
          </div>
        </div>
      </div>

      {/* Canvas area */}
      <div className="relative w-full bg-black/60 rounded-2xl border border-indigo-900/40 overflow-hidden shadow-[inset_0_0_40px_rgba(49,46,129,0.5)] ring-1 ring-white/5 z-10" style={{ height: 420 }}>
        {/* Glow effect */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 blur-[80px] pointer-events-none" />

        {/* Toolbar */}
        <div className="absolute top-4 left-4 z-10 flex items-center gap-2">
          <button
            onClick={addScreen}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-[10px] uppercase font-bold tracking-widest bg-indigo-950/40 border border-indigo-900/50 text-indigo-300 hover:text-white hover:bg-indigo-600/30 hover:border-indigo-500/50 transition-all shadow-[0_0_15px_rgba(0,0,0,0.5)] group backdrop-blur-sm"
          >
            <Plus className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
            Add Screen
          </button>
          {connectingFrom ? (
            <button
              onClick={() => setConnectingFrom(null)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-[10px] uppercase font-bold tracking-widest bg-rose-950/40 border border-rose-900/50 text-rose-400 hover:text-white hover:bg-rose-600/30 hover:border-rose-500/50 transition-all shadow-[0_0_15px_rgba(0,0,0,0.5)] backdrop-blur-sm"
            >
              <Unlink className="w-3.5 h-3.5" />
              Cancel Route
            </button>
          ) : connectingFrom === null && selectedId && (
            <button
              onClick={() => startConnection(selectedId)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-[10px] uppercase font-bold tracking-widest bg-emerald-950/40 border border-emerald-900/50 text-emerald-400 hover:text-white hover:bg-emerald-600/30 hover:border-emerald-500/50 transition-all shadow-[0_0_15px_rgba(0,0,0,0.5)] backdrop-blur-sm group"
            >
              <Link className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
              Connect Route
            </button>
          )}
        </div>

        {/* Badge */}
        <div className="absolute top-4 right-4 z-10 px-3 py-1.5 rounded-lg text-[9px] uppercase font-bold tracking-widest bg-indigo-950/40 border border-indigo-900/50 text-indigo-400/80 shadow-[0_0_15px_rgba(0,0,0,0.5)] backdrop-blur-sm">
          {screens.length} SCREENS <span className="text-indigo-900 font-black mx-1">/</span> {transitions.length} ROUTES
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
              width="32"
              height="32"
              patternUnits="userSpaceOnUse"
              patternTransform={`translate(${pan.x % 32},${pan.y % 32})`}
            >
              <circle cx="16" cy="16" r="1.5" fill="rgba(79,70,229,0.15)" />
            </pattern>
            <filter id="neon-glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
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
                  <path d={line} stroke="rgba(99,102,241,0.5)" strokeWidth={2} fill="none" style={{ filter: 'url(#neon-glow)' }} />
                  <path d={arrows} stroke="rgba(99,102,241,0.8)" strokeWidth={2} fill="none" strokeLinecap="round" />

                  {/* Trigger label */}
                  {midX !== undefined && midY !== undefined && (
                    <g transform={`translate(${midX}, ${midY})`}>
                      <rect
                        x={-tr.trigger.length * 3.5 - 8}
                        y={-10}
                        width={tr.trigger.length * 7 + 16}
                        height={20}
                        rx={6}
                        fill="rgba(3,3,10,0.8)"
                        stroke="rgba(99,102,241,0.4)"
                        strokeWidth={1}
                      />
                      <text
                        x={0}
                        y={3.5}
                        fontSize={8}
                        fill="rgba(165,180,252,0.8)"
                        textAnchor="middle"
                        fontFamily="monospace"
                        fontWeight="bold"
                        letterSpacing="1"
                      >
                        {tr.trigger.toUpperCase()}
                      </text>
                    </g>
                  )}

                  {/* Clickable hit area */}
                  <path
                    d={line}
                    stroke="transparent"
                    strokeWidth={20}
                    fill="none"
                    style={{ cursor: 'pointer' }}
                    onClick={(e) => {
                      e.stopPropagation();
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
                    <circle cx={midX} cy={midY - 16} r={4} fill="rgba(99,102,241,0.8)" />
                  )}
                </g>
              );
            })}

            {/* Screen nodes */}
            {screens.map((scr) => {
              const cfg = SCREEN_TYPES[scr.type];
              const isSelected = selectedId === scr.id;
              const isConnectTarget = connectingFrom !== null && connectingFrom !== scr.id;
              const isBeingDragged = dragState?.screenId === scr.id;

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
                    cursor: isBeingDragged
                      ? 'grabbing'
                      : isConnectTarget
                        ? 'crosshair'
                        : 'pointer',
                    opacity: isBeingDragged ? 0.8 : 1,
                  }}
                >
                  {/* Selection glow */}
                  {isSelected && (
                    <rect
                      x={-4} y={-4}
                      width={NODE_W + 8} height={NODE_H + 8}
                      rx={12} ry={12}
                      fill="rgba(99,102,241,0.05)"
                      stroke="rgba(99,102,241,0.6)"
                      strokeWidth={2}
                      style={{ filter: 'url(#neon-glow)' }}
                    />
                  )}

                  {/* Connect-target highlight */}
                  {isConnectTarget && (
                    <rect
                      x={-3} y={-3}
                      width={NODE_W + 6} height={NODE_H + 6}
                      rx={11} ry={11}
                      fill="rgba(52,211,153,0.05)"
                      stroke="rgba(52,211,153,0.6)"
                      strokeWidth={1.5}
                      strokeDasharray="4,4"
                      className="animate-[spin_4s_linear_infinite]"
                      style={{ transformOrigin: 'center' }}
                    />
                  )}

                  {/* Node body (glassmorphism) */}
                  <rect
                    x={0} y={0}
                    width={NODE_W} height={NODE_H}
                    rx={8} ry={8}
                    fill="rgba(0,0,0,0.6)"
                    stroke={isSelected ? 'rgba(99,102,241,1)' : `${cfg.color}50`}
                    strokeWidth={isSelected ? 2 : 1}
                  />

                  {/* Inner subtle glow */}
                  <rect
                    x={1} y={1}
                    width={NODE_W - 2} height={NODE_H - 2}
                    rx={7} ry={7}
                    fill="none"
                    stroke="rgba(255,255,255,0.05)"
                    strokeWidth={1}
                  />

                  {/* Colored top bar gradient line */}
                  <rect
                    x={0} y={0}
                    width={NODE_W} height={4}
                    rx={4} ry={4}
                    fill={cfg.color}
                    opacity={0.8}
                  />
                  {/* Cover bottom corners of top bar */}
                  <rect x={0} y={2} width={NODE_W} height={2} fill={cfg.color} opacity={0.8} />

                  {/* Type icon background */}
                  <rect x={10} y={14} width={22} height={22} rx={6} fill={`${cfg.color}15`} stroke={`${cfg.color}30`} strokeWidth={1} />
                  <text
                    x={21} y={29}
                    fontSize={12}
                    fill={cfg.color}
                    textAnchor="middle"
                    fontFamily="sans-serif"
                    fontWeight={800}
                    style={{ filter: `drop-shadow(0 0 5px ${cfg.color})` }}
                  >
                    {cfg.icon}
                  </text>

                  {/* Screen name */}
                  <text x={42} y={24} fontSize={11} fill="white" fontFamily="sans-serif" fontWeight={700} letterSpacing="0.5">
                    {scr.name.length > 15 ? scr.name.slice(0, 15) + '…' : scr.name}
                  </text>

                  {/* Type label */}
                  <text x={42} y={35} fontSize={8} fill={`${cfg.color}90`} fontFamily="monospace" fontWeight={600} letterSpacing="1">
                    {cfg.label.toUpperCase()}
                  </text>

                  {/* Widget count indicator string */}
                  <g transform={`translate(10, 48)`}>
                    {/* Tiny nodes representing widgets */}
                    <rect x={0} y={0} width={NODE_W - 20} height={10} rx={3} fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.05)" />
                    {Array.from({ length: Math.min(scr.widgets.length, 12) }).map((_, i) => (
                      <rect key={i} x={4 + i * 8} y={3} width={4} height={4} rx={1} fill={`${cfg.color}80`} />
                    ))}
                    {scr.widgets.length > 12 && (
                      <text x={4 + 12 * 8} y={8} fontSize={8} fill={`${cfg.color}80`}>+</text>
                    )}
                    {scr.widgets.length === 0 && (
                      <text x={5} y={8} fontSize={7} fill="rgba(255,255,255,0.2)" fontFamily="monospace">NO_ELEMENTS</text>
                    )}
                  </g>

                  {/* Action buttons when selected */}
                  {isSelected && (
                    <>
                      {/* Link button */}
                      <g
                        transform={`translate(${NODE_W - 44}, -16)`}
                        onClick={(e) => {
                          e.stopPropagation();
                          startConnection(scr.id);
                        }}
                        style={{ cursor: 'pointer' }}
                        className="group"
                      >
                        <rect x={0} y={0} width={20} height={20} rx={6} fill="rgba(52,211,153,0.15)" stroke="rgba(52,211,153,0.4)" strokeWidth={1} />
                        <text x={10} y={13} fontSize={10} fill="rgba(52,211,153,1)" textAnchor="middle">→</text>
                      </g>
                      {/* Delete button */}
                      <g
                        transform={`translate(${NODE_W - 20}, -16)`}
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteScreen(scr.id);
                        }}
                        style={{ cursor: 'pointer' }}
                        className="group"
                      >
                        <rect x={0} y={0} width={20} height={20} rx={6} fill="rgba(244,63,94,0.15)" stroke="rgba(244,63,94,0.4)" strokeWidth={1} />
                        <text x={10} y={14} fontSize={12} fill="rgba(244,63,94,1)" textAnchor="middle" fontWeight="bold">×</text>
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
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 px-4 py-2 rounded-xl text-[10px] uppercase font-bold tracking-widest bg-amber-950/80 border border-amber-900/50 text-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.2)] backdrop-blur-md animate-pulse">
            Select target matrix node to establish route, or click background to abort
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
        <div className="p-5 bg-black/40 border border-indigo-900/40 rounded-2xl shadow-inner relative z-10">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-indigo-400 font-bold mb-4">
            <Unlink className="w-3.5 h-3.5" />
            Active Routing Pathways
          </div>
          <div className="space-y-2">
            {transitions.map((tr) => {
              const fromScr = screens.find((s) => s.id === tr.fromId);
              const toScr = screens.find((s) => s.id === tr.toId);
              if (!fromScr || !toScr) return null;
              return (
                <div
                  key={tr.id}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl bg-black/60 border border-indigo-900/50 shadow-sm"
                >
                  <div className="flex-1 flex items-center justify-between text-[11px] font-bold tracking-wider uppercase bg-indigo-950/20 rounded-md px-3 py-1.5 border border-indigo-900/30">
                    <span className="text-white drop-shadow-md" style={{ color: SCREEN_TYPES[fromScr.type].color }}>{fromScr.name}</span>
                    <div className="flex flex-col items-center flex-1 px-4">
                      <span className="text-[9px] text-indigo-400/60 font-mono tracking-widest mb-0.5 truncate max-w-[120px]">{tr.trigger}</span>
                      <div className="w-full h-px bg-indigo-900/40 relative">
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-black px-1 text-indigo-500">{tr.bidirectional ? '⟷' : '→'}</div>
                      </div>
                    </div>
                    <span className="text-white drop-shadow-md" style={{ color: SCREEN_TYPES[toScr.type].color }}>{toScr.name}</span>
                  </div>
                  <button
                    onClick={() => toggleBidirectional(tr.id)}
                    className="p-2 rounded-lg border transition-all hover:bg-white/5 active:scale-95"
                    style={{
                      color: tr.bidirectional ? '#6ee7b7' : 'rgba(156,163,175,0.7)',
                      borderColor: tr.bidirectional ? 'rgba(52,211,153,0.4)' : 'rgba(49,46,129,0.5)',
                      backgroundColor: tr.bidirectional ? 'rgba(52,211,153,0.1)' : 'rgba(0,0,0,0.4)',
                    }}
                    title="Toggle Route Bind"
                  >
                    <Link className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => deleteTransition(tr.id)}
                    className="p-2 rounded-lg border border-rose-900/50 bg-rose-950/20 text-rose-500 hover:bg-rose-900/40 hover:text-rose-400 transition-all active:scale-95"
                    title="Sever Route"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Summary & Generate ── */}
      <div className="relative z-10 pt-6 mt-2 border-t border-indigo-900/40">
        <button
          onClick={() => onGenerate(config)}
          disabled={isGenerating || screens.length === 0}
          className="relative w-full overflow-hidden flex items-center justify-center gap-3 px-6 py-4 rounded-xl text-[11px] font-bold uppercase tracking-widest transition-all disabled:opacity-50 group outline-none focus:ring-2 focus:ring-indigo-500/50 focus:ring-offset-2 focus:ring-offset-[#03030a]"
          style={{
            backgroundColor: 'rgba(99,102,241,0.15)',
            color: '#818cf8',
            border: '1px solid rgba(99,102,241,0.5)',
            boxShadow: '0 0 20px rgba(99,102,241,0.2), inset 0 0 10px rgba(99,102,241,0.1)',
          }}
        >
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent opacity-50" />
          <div className="absolute top-0 -left-[100%] w-1/2 h-full bg-gradient-to-r from-transparent via-white/10 to-transparent skew-x-12 group-hover:left-[200%] transition-transform duration-1000 ease-out pointer-events-none" />

          {isGenerating ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin drop-shadow-[0_0_8px_currentColor]" />
              COMPILING_TOPOLOGY...
            </>
          ) : (
            <>
              <Send className="w-4 h-4 group-hover:translate-x-1 transition-transform drop-shadow-[0_0_8px_currentColor]" />
              EXPORT_MENU_ARCHITECTURE
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
    <div className="p-6 bg-black/60 border border-indigo-900/50 rounded-2xl shadow-[0_0_30px_rgba(99,102,241,0.1)_inset] relative z-10 animate-in slide-in-from-bottom-2 fade-in duration-300">
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-indigo-900/40">
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold shadow-inner"
            style={{ backgroundColor: `${cfg.color}15`, color: cfg.color, border: `1px solid ${cfg.color}40`, textShadow: `0 0 10px ${cfg.color}` }}
          >
            {cfg.icon}
          </div>
          <span className="text-[11px] font-bold uppercase tracking-widest text-white drop-shadow-md">Node Configuration</span>
        </div>
        <button onClick={onClose} className="p-2 rounded-lg bg-indigo-950/40 border border-indigo-900/40 text-indigo-400 hover:text-white hover:bg-indigo-600/30 hover:border-indigo-500/50 transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          {/* Name */}
          <div className="space-y-1.5 flex flex-col">
            <label className="text-[9px] uppercase tracking-widest text-indigo-400 font-bold ml-1 flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" /> Identifier String
            </label>
            <input
              type="text"
              value={screen.name}
              onChange={(e) => onUpdate({ name: e.target.value })}
              className="w-full px-4 py-2.5 bg-black/50 border border-indigo-900/60 rounded-xl text-xs font-bold text-white outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400/50 shadow-inner transition-all"
            />
          </div>

          {/* Type */}
          <div className="space-y-1.5 flex flex-col">
            <label className="text-[9px] uppercase tracking-widest text-indigo-400 font-bold ml-1 flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" /> Class Designation
            </label>
            <div className="relative">
              <select
                value={screen.type}
                onChange={(e) => onUpdate({ type: e.target.value as ScreenType })}
                className="w-full px-4 py-2.5 bg-black/50 border border-indigo-900/60 rounded-xl text-xs font-bold text-white outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400/50 shadow-inner appearance-none transition-all cursor-pointer"
                style={{ color: cfg.color }}
              >
                {(Object.entries(SCREEN_TYPES) as [ScreenType, typeof SCREEN_TYPES[ScreenType]][]).map(([key, val]) => (
                  <option key={key} value={key} style={{ backgroundColor: '#0f172a', color: val.color }}>{val.label.toUpperCase()}</option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-indigo-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Widgets */}
        <div className="space-y-2.5 flex flex-col">
          <label className="text-[9px] uppercase tracking-widest text-indigo-400 font-bold ml-1 flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" /> Embedded UI Elements <span className="bg-indigo-900/50 text-indigo-200 px-1.5 py-0.5 rounded text-[8px]">{screen.widgets.length}</span>
          </label>
          <div className="flex-1 bg-black/40 border border-indigo-900/50 rounded-xl p-3 flex flex-col gap-3 shadow-inner max-h-[140px] overflow-y-auto global-scrollbar">
            {screen.widgets.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {screen.widgets.map((w, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] uppercase font-bold tracking-widest border transition-colors shadow-sm"
                    style={{
                      color: 'white',
                      borderColor: `${cfg.color}40`,
                      backgroundColor: `${cfg.color}15`,
                      textShadow: `0 0 10px ${cfg.color}80`
                    }}
                  >
                    {w}
                    <button
                      onClick={() => removeWidget(i)}
                      className="hover:text-rose-400 hover:bg-rose-950/50 p-0.5 rounded -mr-1 transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            ) : (
              <div className="text-[10px] text-indigo-900/50 font-mono uppercase tracking-widest text-center my-auto">
                No embedded elements assigned
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              value={newWidget}
              onChange={(e) => setNewWidget(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') addWidget(); }}
              placeholder="E.G. PROGRESS_BAR_01"
              className="flex-1 px-3 py-2 bg-black/50 border border-indigo-900/60 rounded-lg text-[10px] font-mono text-white placeholder-indigo-900/40 outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400/50 shadow-inner transition-all uppercase tracking-widest"
            />
            <button
              onClick={addWidget}
              disabled={!newWidget.trim()}
              className="px-4 py-2 rounded-lg text-white font-bold transition-all disabled:opacity-30 disabled:grayscale flex items-center justify-center hover:brightness-110 shadow-lg active:scale-95"
              style={{
                backgroundColor: cfg.color,
                boxShadow: `0 0 15px ${cfg.color}40`,
              }}
            >
              <Plus className="w-4 h-4 drop-shadow-md" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
