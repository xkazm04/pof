'use client';

import { useMemo } from 'react';
import { useCLIPanelStore } from '@/components/cli/store/cliPanelStore';
import { useEcwStore } from '@/stores/ecwStore';
import { useRailScope } from './useRailScope';
import { SessionRow } from './SessionRow';

/**
 * Lists CLI sessions in the rail body. Filters by entity scope when an entity
 * is selected (matching on the `sessionKey === 'gen-<entityId>'` convention
 * set by `useGeneration`). Project scope shows all sessions.
 */
export function SessionList() {
  const sessions = useCLIPanelStore((s) => s.sessions);
  const tabOrder = useCLIPanelStore((s) => s.tabOrder);
  const setActiveTab = useCLIPanelStore((s) => s.setActiveTab);
  const scope = useRailScope();

  const visible = useMemo(() => {
    const ordered = tabOrder.map((id) => sessions[id]).filter((s): s is NonNullable<typeof s> => Boolean(s));
    if (scope.kind === 'project') return ordered;
    const key = `gen-${scope.entityId}`;
    return ordered.filter((s) => s.sessionKey === key);
  }, [sessions, tabOrder, scope]);

  const activeEntityId = useEcwStore((s) => s.activeEntityId);

  if (visible.length === 0) {
    return (
      <div className="text-xs text-text-muted/70 italic px-1">
        {scope.kind === 'entity' && activeEntityId
          ? `No sessions for ${activeEntityId} yet — use the inspector's (Re)generate button.`
          : 'No sessions yet — dispatch from an entity inspector.'}
      </div>
    );
  }

  return (
    <ul className="space-y-0.5">
      {visible.map((s) => (
        <li key={s.id}>
          <SessionRow session={s} onSelect={setActiveTab} />
        </li>
      ))}
    </ul>
  );
}
