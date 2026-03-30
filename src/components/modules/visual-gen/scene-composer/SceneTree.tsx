'use client';

import { Box, Eye, EyeOff, Trash2, Copy } from 'lucide-react';
import { useSceneComposerStore } from './useSceneComposerStore';

export function SceneTree() {
  const {
    sceneInfo,
    selectedObject,
    selectObject,
    deleteObject,
    duplicateObject,
  } = useSceneComposerStore();

  if (!sceneInfo) {
    return (
      <div className="text-xs text-text-muted p-3">
        No scene loaded. Connect to Blender and refresh.
      </div>
    );
  }

  return (
    <div className="space-y-0.5">
      <div className="text-[11px] font-medium text-text-muted px-2 py-1">
        Scene Objects ({sceneInfo.objects.length})
      </div>
      {sceneInfo.objects.map((obj) => (
        <button
          key={obj.name}
          onClick={() => selectObject(obj.name)}
          className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs transition-colors ${
            selectedObject === obj.name
              ? 'bg-accent/10 text-accent'
              : 'text-text hover:bg-surface-tertiary'
          }`}
        >
          <Box className="w-3 h-3 shrink-0" />
          <span className="flex-1 text-left truncate">{obj.name}</span>
          <span className="text-[10px] text-text-muted">{obj.type}</span>
          {obj.visible ? (
            <Eye className="w-3 h-3 text-text-muted" />
          ) : (
            <EyeOff className="w-3 h-3 text-text-muted" />
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              duplicateObject(obj.name);
            }}
            className="p-0.5 rounded hover:bg-surface-tertiary"
            title="Duplicate"
          >
            <Copy className="w-3 h-3 text-text-muted" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              deleteObject(obj.name);
            }}
            className="p-0.5 rounded hover:bg-red-500/10"
            title="Delete"
          >
            <Trash2 className="w-3 h-3 text-red-400" />
          </button>
        </button>
      ))}
    </div>
  );
}
