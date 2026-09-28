import { useState, useCallback, useRef } from 'react';
import type { RoomNode } from '@/types/level-design';
import { useBlenderMCPStore } from '@/stores/blenderMCPStore';
import { tryApiFetch } from '@/lib/api-utils';
import { levelBlockoutScript } from '@/lib/blender-mcp/scripts/level-blockout';
import type { BlockoutRoom } from '@/lib/blender-mcp/scripts/level-blockout';
import type { ExecuteOutput } from '@/lib/blender-mcp/types';
import { logger } from '@/lib/logger';
import { ROOM_W, ROOM_H, ROOM_TYPE_CONFIG } from './constants';
import type { LevelFlowEditorProps } from './types';

export function useLevelFlowEditor({
  rooms,
  onEdit,
  history,
  onSelectRoom,
  selectedRoomId,
  readOnly = false,
}: LevelFlowEditorProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [dragState, setDragState] = useState<{
    roomId: string;
    offsetX: number;
    offsetY: number;
  } | null>(null);
  /** The drag's latest position — mouseup commits it; null until the node moved (a click never writes). */
  const lastDragPosRef = useRef<{ x: number; y: number } | null>(null);
  /** Per-editor id sequence: two rooms added in the same millisecond stay distinct. */
  const roomSeqRef = useRef(0);
  const [connectingFrom, setConnectingFrom] = useState<string | null>(null);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 });

  /** Link queued for deletion — a first click/Enter arms, a second confirms. */
  const [armedConnectionId, setArmedConnectionId] = useState<string | null>(null);
  /** Room queued for deletion — drives the confirm dialog (deleting drops its links too). */
  const [pendingDeleteRoomId, setPendingDeleteRoomId] = useState<string | null>(null);

  // Blender blockout
  const [blenderExporting, setBlenderExporting] = useState(false);
  const [blenderResult, setBlenderResult] = useState<{ message: string; isError: boolean } | null>(null);
  const blenderConnected = useBlenderMCPStore((s) => s.connection.connected);

  // ── Room CRUD ──

  const addRoom = useCallback(() => {
    const id = `room-${Date.now()}-${++roomSeqRef.current}`;
    const newRoom: RoomNode = {
      id,
      name: `Room ${rooms.length + 1}`,
      type: 'combat',
      description: '',
      encounterDesign: '',
      difficulty: 2,
      pacing: 'rising',
      x: 100 + Math.random() * 200 - pan.x,
      y: 100 + Math.random() * 200 - pan.y,
      linkedFiles: [],
      spawnEntries: [],
      tags: [],
    };
    if (onEdit({ kind: 'add-room', room: newRoom })) onSelectRoom(id);
  }, [rooms, onEdit, onSelectRoom, pan]);

  /** ONE op: the room, its links, its arc entry and its sync rows go in one write. */
  const deleteRoom = useCallback((roomId: string) => {
    if (onEdit({ kind: 'delete-room', roomId }) && selectedRoomId === roomId) onSelectRoom(null);
  }, [onEdit, selectedRoomId, onSelectRoom]);

  /** Deleting a room also drops its links, so it goes through a confirm step. */
  const requestDeleteRoom = useCallback((roomId: string) => {
    if (readOnly) return;
    setPendingDeleteRoomId(roomId);
  }, [readOnly]);

  const cancelDeleteRoom = useCallback(() => setPendingDeleteRoomId(null), []);

  const confirmDeleteRoom = useCallback(() => {
    if (pendingDeleteRoomId) deleteRoom(pendingDeleteRoomId);
    setPendingDeleteRoomId(null);
  }, [pendingDeleteRoomId, deleteRoom]);

  /**
   * Keyboard alternative to dragging a node with the mouse. Held arrow keys
   * auto-repeat, so the move is buffered locally and written once the repeat
   * settles — same one-edit-one-write rule as a mouse drag, and one undo step.
   */
  const nudgeRoom = useCallback((roomId: string, dx: number, dy: number) => {
    if (readOnly) return;
    onEdit({ kind: 'nudge-room', roomId, dx, dy }, 'debounce');
  }, [readOnly, onEdit]);

  // ── Connection handling ──

  const startConnection = useCallback((roomId: string) => {
    setConnectingFrom(roomId);
  }, []);

  const completeConnection = useCallback((toId: string) => {
    if (!connectingFrom || connectingFrom === toId) {
      setConnectingFrom(null);
      return;
    }
    // The op refuses a duplicate link (either direction) and says so.
    onEdit({ kind: 'link', fromId: connectingFrom, toId });
    setConnectingFrom(null);
  }, [connectingFrom, onEdit]);

  const deleteConnection = useCallback((connId: string) => {
    onEdit({ kind: 'unlink', connectionId: connId });
    setArmedConnectionId((cur) => (cur === connId ? null : cur));
  }, [onEdit]);

  /**
   * Link deletion is two-step: the hit area is a wide invisible line, so a single
   * stray click must never destroy a connection. First activation arms, second deletes.
   */
  const toggleArmConnection = useCallback((connId: string) => {
    if (readOnly) return;
    setArmedConnectionId((cur) => (cur === connId ? null : connId));
  }, [readOnly]);

  const disarmConnection = useCallback(() => setArmedConnectionId(null), []);

  // ── Drag handling ──

  const getSVGPoint = useCallback((e: React.MouseEvent | MouseEvent) => {
    if (!svgRef.current) return { x: 0, y: 0 };
    const rect = svgRef.current.getBoundingClientRect();
    return {
      x: e.clientX - rect.left - pan.x,
      y: e.clientY - rect.top - pan.y,
    };
  }, [pan]);

  const handleMouseDown = useCallback((e: React.MouseEvent, roomId: string) => {
    if (readOnly) return;
    e.stopPropagation();

    if (connectingFrom) {
      completeConnection(roomId);
      return;
    }

    const pt = getSVGPoint(e);
    const room = rooms.find((r) => r.id === roomId);
    if (!room) return;

    setDragState({
      roomId,
      offsetX: pt.x - room.x,
      offsetY: pt.y - room.y,
    });
    onSelectRoom(roomId);
  }, [readOnly, connectingFrom, completeConnection, getSVGPoint, rooms, onSelectRoom]);

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
    // Staged, not written: a drag is ONE edit (and one undo step) however many frames it spans.
    const pos = { x: pt.x - dragState.offsetX, y: pt.y - dragState.offsetY };
    lastDragPosRef.current = pos;
    onEdit({ kind: 'move-room', roomId: dragState.roomId, ...pos }, 'stage');
  }, [dragState, isPanning, getSVGPoint, onEdit]);

  const handleMouseUp = useCallback(() => {
    // Mouseup is the commit boundary: the drag's final position, written exactly once.
    const pos = lastDragPosRef.current;
    if (dragState && pos) onEdit({ kind: 'move-room', roomId: dragState.roomId, ...pos }, 'commit');
    lastDragPosRef.current = null;
    setDragState(null);
    setIsPanning(false);
  }, [dragState, onEdit]);

  /** Canvas keys: Escape cancels a pending link/arm; Ctrl/Cmd+Z undo, +Shift (or Ctrl+Y) redo. */
  const handleCanvasKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setConnectingFrom(null);
      setArmedConnectionId(null);
      return;
    }
    if (readOnly || !history || !(e.ctrlKey || e.metaKey)) return;
    const key = e.key.toLowerCase();
    if (key === 'z' && !e.shiftKey) {
      e.preventDefault();
      history.onUndo();
    } else if ((key === 'z' && e.shiftKey) || key === 'y') {
      e.preventDefault();
      history.onRedo();
    }
  }, [readOnly, history]);

  const handleSvgMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.target === svgRef.current || (e.target as SVGElement).tagName === 'rect') {
      setArmedConnectionId(null);
      if (connectingFrom) {
        setConnectingFrom(null);
        return;
      }
      panStart.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
      setIsPanning(true);
      onSelectRoom(null);
    }
  }, [connectingFrom, pan, onSelectRoom]);

  // ── Get room center for connections ──

  const getRoomCenter = useCallback((roomId: string) => {
    const room = rooms.find((r) => r.id === roomId);
    if (!room) return { x: 0, y: 0 };
    return { x: room.x + ROOM_W / 2, y: room.y + ROOM_H / 2 };
  }, [rooms]);

  const handleBlockoutInBlender = useCallback(async () => {
    setBlenderExporting(true);
    setBlenderResult(null);
    try {
      const hexToRgb = (hex: string): [number, number, number] => {
        const h = hex.replace('#', '');
        return [
          parseInt(h.substring(0, 2), 16) / 255,
          parseInt(h.substring(2, 4), 16) / 255,
          parseInt(h.substring(4, 6), 16) / 255,
        ];
      };
      const blockoutRooms: BlockoutRoom[] = rooms.map((room) => {
        const cfg = ROOM_TYPE_CONFIG[room.type];
        return {
          id: room.id,
          name: room.name,
          type: room.type,
          x: room.x / 100,
          y: room.y / 100,
          width: ROOM_W / 50,
          height: ROOM_H / 50,
          color: hexToRgb(cfg.color),
        };
      });
      const code = levelBlockoutScript({ rooms: blockoutRooms, wallHeight: 3 });
      const result = await tryApiFetch<ExecuteOutput>('/api/blender-mcp/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      if (result.ok) {
        setBlenderResult({ message: result.data.output || `Blockout created: ${rooms.length} rooms`, isError: false });
      } else {
        setBlenderResult({ message: result.error, isError: true });
      }
    } catch (e) {
      logger.warn('Blender blockout failed', e);
      setBlenderResult({ message: e instanceof Error ? e.message : 'Blockout failed', isError: true });
    } finally {
      setBlenderExporting(false);
    }
  }, [rooms]);

  const dismissBlenderResult = useCallback(() => setBlenderResult(null), []);

  return {
    svgRef,
    dragState,
    connectingFrom,
    setConnectingFrom,
    pan,
    isPanning,
    blenderExporting,
    blenderResult,
    blenderConnected,
    dismissBlenderResult,
    armedConnectionId,
    toggleArmConnection,
    disarmConnection,
    pendingDeleteRoomId,
    requestDeleteRoom,
    cancelDeleteRoom,
    confirmDeleteRoom,
    nudgeRoom,
    addRoom,
    deleteRoom,
    startConnection,
    completeConnection,
    deleteConnection,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleSvgMouseDown,
    handleCanvasKeyDown,
    getRoomCenter,
    handleBlockoutInBlender,
  };
}
