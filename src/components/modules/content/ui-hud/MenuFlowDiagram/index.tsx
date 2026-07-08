'use client';

import { Link, Send, Loader2 } from 'lucide-react';
import { STATUS_STALE } from '@/lib/chart-colors';
import { useMenuFlowDiagram } from './useMenuFlowDiagram';
import { FlowCanvas } from './FlowCanvas';
import { ScreenEditor } from './ScreenEditor';
import { TransitionList } from './TransitionList';
import type { MenuFlowConfig } from './types';

// ── Re-exports (preserve original public surface) ──
export type { ScreenType, ScreenNode, ScreenTransition, MenuFlowConfig } from './types';
export { DEFAULT_MENU_FLOW } from './constants';

// ── Props ──

interface MenuFlowDiagramProps {
  onGenerate: (config: MenuFlowConfig) => void;
  isGenerating: boolean;
}

// ── Component ──

export function MenuFlowDiagram({ onGenerate, isGenerating }: MenuFlowDiagramProps) {
  const {
    screens, transitions, selectedId, connectingFrom, editingScreen,
    setConnectingFrom, setEditingScreen,
    svgRef, pan, isPanning, dragState,
    addScreen, deleteScreen, updateScreen,
    startConnection, completeConnection, deleteTransition, toggleBidirectional,
    handleNodeMouseDown, handleMouseMove, handleMouseUp, handleSvgMouseDown,
    getNodeCenter, selectedScreen, config, getArrowPath,
  } = useMenuFlowDiagram();

  return (
    <div className="space-y-6 bg-[#03030a] p-6 rounded-2xl border border-violet-900/30 shadow-[inset_0_0_80px_rgba(167,139,250,0.05)] relative w-full overflow-hidden">
      {/* Ambient tech background */}
      <div className="absolute inset-0 pointer-events-none z-0">
        <div className="absolute -top-1/4 -right-1/4 w-[500px] h-[500px] bg-violet-600/10 blur-[120px] rounded-full pointer-events-none" />
        <div className="absolute bottom-1/4 -left-1/4 w-[500px] h-[500px] bg-violet-600/10 blur-[120px] rounded-full pointer-events-none" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:32px_32px] [mask-image:radial-gradient(ellipse_at_center,black_20%,transparent_70%)] opacity-30 pointer-events-none" />
      </div>

      <div className="relative z-10 w-full mb-6 border-b border-violet-900/40 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center shadow-[inset_0_0_15px_rgba(167,139,250,0.1)]">
            <Link className="w-5 h-5 text-violet-400" />
          </div>
          <div>
            <h3 className="text-sm font-bold tracking-widest uppercase text-violet-100 shadow-[0_0_10px_rgba(167,139,250,0.5)]">UI Node Flow Matrix</h3>
            <p className="text-xs text-violet-400/60 uppercase mt-1">
              INTERFACE_TOPOLOGY_AND_SCREEN_ROUTING
            </p>
          </div>
        </div>
      </div>

      {/* Canvas area */}
      <FlowCanvas
        screens={screens}
        transitions={transitions}
        selectedId={selectedId}
        connectingFrom={connectingFrom}
        dragState={dragState}
        isPanning={isPanning}
        pan={pan}
        svgRef={svgRef}
        addScreen={addScreen}
        setConnectingFrom={setConnectingFrom}
        startConnection={startConnection}
        handleSvgMouseDown={handleSvgMouseDown}
        handleMouseMove={handleMouseMove}
        handleMouseUp={handleMouseUp}
        getNodeCenter={getNodeCenter}
        getArrowPath={getArrowPath}
        toggleBidirectional={toggleBidirectional}
        deleteTransition={deleteTransition}
        handleNodeMouseDown={handleNodeMouseDown}
        setEditingScreen={setEditingScreen}
        completeConnection={completeConnection}
        deleteScreen={deleteScreen}
      />

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
        <TransitionList
          screens={screens}
          transitions={transitions}
          toggleBidirectional={toggleBidirectional}
          deleteTransition={deleteTransition}
        />
      )}

      {/* ── Summary & Generate ── */}
      <div className="relative z-10 pt-6 mt-2 border-t border-violet-900/40">
        <button
          onClick={() => onGenerate(config)}
          disabled={isGenerating || screens.length === 0}
          className="relative w-full overflow-hidden flex items-center justify-center gap-3 px-6 py-4 rounded-xl text-[11px] font-bold uppercase transition-all disabled:opacity-50 group outline-none focus:ring-2 focus:ring-violet-500/50 focus:ring-offset-2 focus:ring-offset-[#03030a]"
          style={{
            backgroundColor: 'rgba(167,139,250,0.15)',
            color: STATUS_STALE,
            border: '1px solid rgba(167,139,250,0.5)',
            boxShadow: '0 0 20px rgba(167,139,250,0.2), inset 0 0 10px rgba(167,139,250,0.1)',
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
