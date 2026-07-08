import { useState, useCallback, useRef, useMemo } from 'react';
import { NODE_W, NODE_H, DEFAULT_SCREENS, DEFAULT_TRANSITIONS } from './constants';
import type { ScreenNode, ScreenTransition, MenuFlowConfig } from './types';

export function useMenuFlowDiagram() {
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

  return {
    screens, transitions, selectedId, connectingFrom, editingScreen,
    setSelectedId, setConnectingFrom, setEditingScreen,
    svgRef, pan, isPanning, dragState,
    addScreen, deleteScreen, updateScreen,
    startConnection, completeConnection, deleteTransition, toggleBidirectional,
    handleNodeMouseDown, handleMouseMove, handleMouseUp, handleSvgMouseDown,
    getNodeCenter, selectedScreen, config, getArrowPath,
  };
}
