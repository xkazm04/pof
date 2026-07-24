'use client';

import { useLevelFlowEditor } from './useLevelFlowEditor';
import { EditorOverlays } from './EditorOverlays';
import { ConnectionLines } from './ConnectionLines';
import { RoomNodeGraphic } from './RoomNodeGraphic';
import { DesktopCanvasNotice } from '@/components/ui/DesktopCanvasNotice';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import type { LevelFlowEditorProps } from './types';

export type { LevelFlowEditorProps } from './types';

/** Shortcut hints surfaced to screen readers on the room list. */
const ROOM_LIST_HINT =
  'Arrow keys move between rooms, Shift plus arrow keys move the selected room, Enter selects, L starts a link, Delete removes a room, Escape cancels.';

export function LevelFlowEditor(props: LevelFlowEditorProps) {
  const {
    rooms,
    connections,
    selectedRoomId,
    accentColor,
    readOnly = false,
    findingsByRoom,
    onSelectRoom,
  } = props;

  const {
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
    startConnection,
    completeConnection,
    deleteConnection,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleSvgMouseDown,
    getRoomCenter,
    handleBlockoutInBlender,
  } = useLevelFlowEditor(props);

  const getRoomName = (roomId: string) => rooms.find((r) => r.id === roomId)?.name ?? 'unknown room';

  // Roving tabindex: exactly one room node sits in the tab order.
  const tabStopId = rooms.find((r) => r.id === selectedRoomId)?.id ?? rooms[0]?.id ?? null;

  const pendingRoom = pendingDeleteRoomId ? rooms.find((r) => r.id === pendingDeleteRoomId) : undefined;
  const pendingLinkCount = pendingDeleteRoomId
    ? connections.filter((c) => c.fromId === pendingDeleteRoomId || c.toId === pendingDeleteRoomId).length
    : 0;

  return (
    <div className="relative w-full h-full bg-[#03030a] rounded-2xl border border-violet-900/30 overflow-hidden shadow-[inset_0_0_80px_rgba(167,139,250,0.05)]">
      <DesktopCanvasNotice className="absolute top-2 left-1/2 -translate-x-1/2 z-30 max-w-[90%]" />
      {/* Background Gradients */}
      <div className="absolute inset-0 pointer-events-none z-0">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-violet-600/10 blur-[120px] rounded-full pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-emerald-600/5 blur-[100px] rounded-full pointer-events-none" />
      </div>

      <EditorOverlays
        readOnly={readOnly}
        accentColor={accentColor}
        addRoom={addRoom}
        handleBlockoutInBlender={handleBlockoutInBlender}
        blenderConnected={blenderConnected}
        blenderExporting={blenderExporting}
        connectingFrom={connectingFrom}
        setConnectingFrom={setConnectingFrom}
        roomsLength={rooms.length}
        connectionsLength={connections.length}
        blenderResult={blenderResult}
        dismissBlenderResult={dismissBlenderResult}
      />

      {/* SVG Canvas */}
      <svg
        ref={svgRef}
        className="w-full h-full relative z-0"
        style={{ cursor: isPanning ? 'grabbing' : connectingFrom ? 'crosshair' : 'grab' }}
        role="group"
        aria-label={`Level flow graph: ${rooms.length} rooms, ${connections.length} links`}
        onMouseDown={handleSvgMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onKeyDown={(e) => {
          if (e.key !== 'Escape') return;
          if (connectingFrom) setConnectingFrom(null);
          if (armedConnectionId) disarmConnection();
        }}
      >
        <defs>
          {/* Blueprint Dot Grid */}
          <pattern id="grid" width="32" height="32" patternUnits="userSpaceOnUse"
            patternTransform={`translate(${pan.x % 32},${pan.y % 32})`}
          >
            <circle cx="16" cy="16" r="1" fill={accentColor} opacity="0.15" />
            <path d="M 16 12 L 16 20 M 12 16 L 20 16" stroke={accentColor} strokeWidth="0.5" opacity="0.05" />
          </pattern>
          {/* Glow Filters */}
          <filter id="glow-node" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
          <filter id="glow-link" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />

        <g transform={`translate(${pan.x},${pan.y})`}>
          {/* Connections */}
          <ConnectionLines
            connections={connections}
            connectingFrom={connectingFrom}
            accentColor={accentColor}
            readOnly={readOnly}
            armedConnectionId={armedConnectionId}
            getRoomCenter={getRoomCenter}
            getRoomName={getRoomName}
            toggleArmConnection={toggleArmConnection}
            deleteConnection={deleteConnection}
          />

          {/* Room nodes */}
          <g role="listbox" aria-label={`Rooms. ${ROOM_LIST_HINT}`}>
            {rooms.map((room) => (
              <RoomNodeGraphic
                key={room.id}
                room={room}
                selectedRoomId={selectedRoomId}
                connectingFrom={connectingFrom}
                accentColor={accentColor}
                dragState={dragState}
                findingsByRoom={findingsByRoom}
                readOnly={readOnly}
                isTabStop={room.id === tabStopId}
                handleMouseDown={handleMouseDown}
                completeConnection={completeConnection}
                startConnection={startConnection}
                requestDeleteRoom={requestDeleteRoom}
                selectRoom={onSelectRoom}
                nudgeRoom={nudgeRoom}
                cancelConnecting={() => setConnectingFrom(null)}
              />
            ))}
          </g>
        </g>
      </svg>

      <ConfirmDialog
        open={Boolean(pendingRoom)}
        onClose={cancelDeleteRoom}
        onConfirm={confirmDeleteRoom}
        title="Delete this room?"
        description={
          pendingLinkCount > 0
            ? `"${pendingRoom?.name}" and its ${pendingLinkCount} ${pendingLinkCount === 1 ? 'link' : 'links'} will be removed. This can't be undone.`
            : `"${pendingRoom?.name}" will be removed. This can't be undone.`
        }
        confirmLabel="Delete room"
      />
    </div>
  );
}
