'use client';

import { useLevelFlowEditor } from './useLevelFlowEditor';
import { EditorOverlays } from './EditorOverlays';
import { ConnectionLines } from './ConnectionLines';
import { RoomNodeGraphic } from './RoomNodeGraphic';
import type { LevelFlowEditorProps } from './types';

export type { LevelFlowEditorProps } from './types';

export function LevelFlowEditor(props: LevelFlowEditorProps) {
  const {
    rooms,
    connections,
    selectedRoomId,
    accentColor,
    readOnly = false,
    findingsByRoom,
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
    addRoom,
    deleteRoom,
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

  return (
    <div className="relative w-full h-full bg-[#03030a] rounded-2xl border border-violet-900/30 overflow-hidden shadow-[inset_0_0_80px_rgba(167,139,250,0.05)]">
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
      />

      {/* SVG Canvas */}
      <svg
        ref={svgRef}
        className="w-full h-full relative z-0"
        style={{ cursor: isPanning ? 'grabbing' : connectingFrom ? 'crosshair' : 'grab' }}
        onMouseDown={handleSvgMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
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
            getRoomCenter={getRoomCenter}
            deleteConnection={deleteConnection}
          />

          {/* Room nodes */}
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
              handleMouseDown={handleMouseDown}
              completeConnection={completeConnection}
              startConnection={startConnection}
              deleteRoom={deleteRoom}
            />
          ))}
        </g>
      </svg>
    </div>
  );
}
