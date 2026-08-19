'use client';

import { useState } from 'react';
import { Box, Eye, EyeOff, Trash2, Copy, RefreshCw } from 'lucide-react';
import { InlineErrorRetry } from '../../shared/InlineErrorRetry';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Tooltip } from '@/components/ui/Tooltip';
import { useSceneComposerStore } from './useSceneComposerStore';

export function SceneTree() {
  const {
    sceneInfo,
    selectedObject,
    selectObject,
    deleteObject,
    duplicateObject,
    isRefreshing,
    lastError,
    actionError,
    actionResult,
    failedAction,
    hasRefreshed,
    refreshScene,
    clearActionFeedback,
  } = useSceneComposerStore();

  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  const objectCount = sceneInfo?.objects.length ?? 0;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between px-2">
        <span
          className="text-[11px] font-medium text-text-muted"
          aria-live="polite"
        >
          {sceneInfo
            ? `Scene Objects (${objectCount})`
            : 'Scene Objects'}
        </span>
        <Tooltip content="Reload the scene from Blender">
          <button
            onClick={() => refreshScene()}
            disabled={isRefreshing}
            aria-label="Refresh scene"
            className="focus-ring flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] text-text-muted hover:text-text hover:bg-surface-tertiary transition-colors disabled:opacity-40"
          >
            <RefreshCw
              className={`w-3 h-3 ${isRefreshing ? 'animate-spin' : ''}`}
            />
            {isRefreshing ? 'Refreshing…' : 'Refresh'}
          </button>
        </Tooltip>
      </div>

      {lastError && (
        <InlineErrorRetry
          dense
          message={`Scene refresh failed: ${lastError}`}
          onRetry={() => refreshScene()}
        />
      )}

      {/* A destructive operation that did not happen must say so. Distinct from
          the refresh banner above: the tree is fine, the ACT failed. */}
      {actionError && (
        <InlineErrorRetry
          dense
          message={actionError}
          onRetry={() => {
            if (!failedAction) return;
            if (failedAction.op === 'delete') deleteObject(failedAction.name);
            else duplicateObject(failedAction.name);
          }}
          onDismiss={clearActionFeedback}
        />
      )}

      {actionResult && (
        <p
          role="status"
          aria-live="polite"
          className="px-2 text-xs text-emerald-400"
        >
          {actionResult}
        </p>
      )}

      {!sceneInfo ? (
        <div className="text-xs text-text-muted p-3" aria-live="polite">
          {isRefreshing
            ? 'Loading scene…'
            : lastError
              ? 'No scene loaded — the last refresh failed. Check the Blender connection and retry above.'
              : hasRefreshed
                ? 'No scene data returned. Refresh to try again.'
                : 'No scene loaded. Connect to Blender and refresh.'}
        </div>
      ) : objectCount === 0 ? (
        <div className="text-xs text-text-muted p-3">
          Scene is empty — no objects to show.
        </div>
      ) : (
        <ul role="listbox" aria-label="Scene objects" className="space-y-0.5">
          {sceneInfo.objects.map((obj) => {
            const selected = selectedObject === obj.name;
            return (
              <li
                key={obj.name}
                role="option"
                aria-selected={selected}
                className={`group flex items-center gap-2 px-2 py-1.5 rounded text-xs transition-colors ${
                  selected
                    ? 'bg-accent/10 text-accent'
                    : 'text-text hover:bg-surface-tertiary'
                }`}
              >
                <button
                  onClick={() => selectObject(obj.name)}
                  className="focus-ring flex-1 flex items-center gap-2 min-w-0 text-left"
                >
                  <Box className="w-3 h-3 shrink-0" />
                  <span className="flex-1 truncate">{obj.name}</span>
                  <span className="text-xs text-text-muted">{obj.type}</span>
                  {obj.visible ? (
                    <Eye className="w-3 h-3 text-text-muted" aria-label="Visible" />
                  ) : (
                    <EyeOff className="w-3 h-3 text-text-muted" aria-label="Hidden" />
                  )}
                </button>
                <Tooltip content="Duplicate">
                  <button
                    onClick={() => duplicateObject(obj.name)}
                    aria-label={`Duplicate ${obj.name}`}
                    className="focus-ring p-0.5 rounded hover:bg-surface-tertiary"
                  >
                    <Copy className="w-3 h-3 text-text-muted" />
                  </button>
                </Tooltip>
                <Tooltip content="Delete">
                  <button
                    onClick={() => setPendingDelete(obj.name)}
                    aria-label={`Delete ${obj.name}`}
                    className="focus-ring p-0.5 rounded hover:bg-red-500/10"
                  >
                    <Trash2 className="w-3 h-3 text-red-400" />
                  </button>
                </Tooltip>
              </li>
            );
          })}
        </ul>
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        onConfirm={() => {
          if (pendingDelete) deleteObject(pendingDelete);
        }}
        title="Delete object?"
        description={
          <>
            This permanently removes{' '}
            <span className="text-text font-medium">{pendingDelete}</span> from the
            Blender scene. This cannot be undone from here.
          </>
        }
        confirmLabel="Delete"
      />
    </div>
  );
}
