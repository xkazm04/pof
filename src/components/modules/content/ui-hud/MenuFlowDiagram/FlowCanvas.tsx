'use client';

import { Plus, Link, Unlink } from 'lucide-react';
import { TransitionArrow } from './TransitionArrow';
import { ScreenNodeView } from './ScreenNodeView';
import type { ScreenNode, ScreenTransition } from './types';

interface FlowCanvasProps {
  screens: ScreenNode[];
  transitions: ScreenTransition[];
  selectedId: string | null;
  connectingFrom: string | null;
  dragState: { screenId: string; offsetX: number; offsetY: number } | null;
  isPanning: boolean;
  pan: { x: number; y: number };
  svgRef: React.RefObject<SVGSVGElement | null>;
  addScreen: () => void;
  setConnectingFrom: (id: string | null) => void;
  startConnection: (fromId: string) => void;
  handleSvgMouseDown: (e: React.MouseEvent) => void;
  handleMouseMove: (e: React.MouseEvent) => void;
  handleMouseUp: () => void;
  getNodeCenter: (id: string) => { x: number; y: number };
  getArrowPath: (
    from: { x: number; y: number },
    to: { x: number; y: number },
    bidir: boolean
  ) => { line: string; arrows: string; midX?: number; midY?: number };
  toggleBidirectional: (id: string) => void;
  deleteTransition: (id: string) => void;
  handleNodeMouseDown: (e: React.MouseEvent, screenId: string) => void;
  setEditingScreen: (id: string | null) => void;
  completeConnection: (toId: string) => void;
  deleteScreen: (id: string) => void;
}

export function FlowCanvas({
  screens,
  transitions,
  selectedId,
  connectingFrom,
  dragState,
  isPanning,
  pan,
  svgRef,
  addScreen,
  setConnectingFrom,
  startConnection,
  handleSvgMouseDown,
  handleMouseMove,
  handleMouseUp,
  getNodeCenter,
  getArrowPath,
  toggleBidirectional,
  deleteTransition,
  handleNodeMouseDown,
  setEditingScreen,
  completeConnection,
  deleteScreen,
}: FlowCanvasProps) {
  return (
    <div className="relative w-full bg-black/60 rounded-2xl border border-violet-900/40 overflow-hidden shadow-[inset_0_0_40px_rgba(49,46,129,0.5)] ring-1 ring-white/5 z-10" style={{ height: 420 }}>
      {/* Glow effect */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-violet-500/5 blur-[80px] pointer-events-none" />

      {/* Toolbar */}
      <div className="absolute top-4 left-4 z-10 flex items-center gap-2">
        <button
          onClick={addScreen}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs uppercase font-bold bg-violet-950/40 border border-violet-900/50 text-violet-300 hover:text-white hover:bg-violet-600/30 hover:border-violet-500/50 transition-all shadow-[0_0_15px_rgba(0,0,0,0.5)] group backdrop-blur-sm"
        >
          <Plus className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
          Add Screen
        </button>
        {connectingFrom ? (
          <button
            onClick={() => setConnectingFrom(null)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs uppercase font-bold bg-rose-950/40 border border-rose-900/50 text-rose-400 hover:text-white hover:bg-rose-600/30 hover:border-rose-500/50 transition-all shadow-[0_0_15px_rgba(0,0,0,0.5)] backdrop-blur-sm"
          >
            <Unlink className="w-3.5 h-3.5" />
            Cancel Route
          </button>
        ) : connectingFrom === null && selectedId && (
          <button
            onClick={() => startConnection(selectedId)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs uppercase font-bold bg-emerald-950/40 border border-emerald-900/50 text-emerald-400 hover:text-white hover:bg-emerald-600/30 hover:border-emerald-500/50 transition-all shadow-[0_0_15px_rgba(0,0,0,0.5)] backdrop-blur-sm group"
          >
            <Link className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
            Connect Route
          </button>
        )}
      </div>

      {/* Badge */}
      <div className="absolute top-4 right-4 z-10 px-3 py-1.5 rounded-lg text-[11px] uppercase font-bold bg-violet-950/40 border border-violet-900/50 text-violet-400/80 shadow-[0_0_15px_rgba(0,0,0,0.5)] backdrop-blur-sm">
        {screens.length} SCREENS <span className="text-violet-900 font-black mx-1">/</span> {transitions.length} ROUTES
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
          {transitions.map((tr) => (
            <TransitionArrow
              key={tr.id}
              tr={tr}
              getNodeCenter={getNodeCenter}
              getArrowPath={getArrowPath}
              toggleBidirectional={toggleBidirectional}
              deleteTransition={deleteTransition}
            />
          ))}

          {/* Screen nodes */}
          {screens.map((scr) => (
            <ScreenNodeView
              key={scr.id}
              scr={scr}
              selectedId={selectedId}
              connectingFrom={connectingFrom}
              dragState={dragState}
              handleNodeMouseDown={handleNodeMouseDown}
              setEditingScreen={setEditingScreen}
              completeConnection={completeConnection}
              startConnection={startConnection}
              deleteScreen={deleteScreen}
            />
          ))}
        </g>
      </svg>

      {/* Help text */}
      {connectingFrom && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 px-4 py-2 rounded-xl text-xs uppercase font-bold bg-amber-950/80 border border-amber-900/50 text-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.2)] backdrop-blur-md animate-pulse">
          Select target matrix node to establish route, or click background to abort
        </div>
      )}
    </div>
  );
}
